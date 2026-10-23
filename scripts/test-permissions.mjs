// Permission matrix and edge cases: every role against every table and every function,
// plus the validation paths the browser suite can't safely trigger on the live event.
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;`);
await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));

const ids = {};
async function user(key, email) { ids[key] = randomUUID(); await db.query('insert into auth.users values ($1, $2, now())', [ids[key], email]); }
async function as(key, sql, params = []) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [key ? ids[key] : '']);
  await db.exec(key ? 'set role authenticated' : 'set role anon');
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
}
async function fails(promise, code) {
  await assert.rejects(promise, e => { assert.equal(e.code, code, `${e.code}: ${e.message}`); return true; });
}
const at = h => new Date(Date.now() + h * 36e5).toISOString();

// Cast: organizer, reviewer, two participants, and a signed-in stranger.
await db.exec(`insert into public.staff_invites (email, role) values ('org@q.test','organizer'), ('rev@q.test','reviewer'), ('rev2@q.test','reviewer'), ('rev3@q.test','reviewer')`);
await db.exec(`insert into public.participants (email, display_name) values ('a@q.test','Ana'), ('b@q.test','Ben'), ('c@q.test','Cam'), ('d@q.test','Dee'), ('e@q.test','Eli')`);
for (const [k, e] of [['org', 'org@q.test'], ['rev', 'rev@q.test'], ['rev2', 'rev2@q.test'], ['rev3', 'rev3@q.test'], ['a', 'a@q.test'], ['b', 'b@q.test'], ['c', 'c@q.test'], ['d', 'd@q.test'], ['e', 'e@q.test'], ['x', 'x@q.test']]) await user(k, e);

const TABLES = ['participants', 'staff_invites', 'user_roles', 'event_settings', 'submissions', 'reviewer_assignments', 'reviews', 'ballots', 'ballot_selections', 'awards', 'result_decisions', 'audit_logs'];

test('anonymous visitors only see public event settings', async () => {
  for (const t of TABLES) {
    if (t === 'event_settings') assert.equal((await as(null, `select * from public.${t}`)).length, 1);
    else await fails(as(null, `select * from public.${t}`), '42501');
  }
  for (const fn of ['project_wall()', 'my_voting_status()', 'vote_results()', 'admin_overview()', 'shortlist_tally()']) {
    await fails(as(null, `select * from public.${fn}`), '42501');
  }
});

test('no role can write to any table directly', async () => {
  for (const who of ['org', 'rev', 'a']) {
    for (const t of TABLES) {
      await fails(as(who, `delete from public.${t}`), '42501');
      const col = {staff_invites: 'email', user_roles: 'role', ballot_selections: 'ballot_id', event_settings: 'name', audit_logs: 'action'}[t] ?? 'id';
      await fails(as(who, `update public.${t} set ${col} = ${col}`), '42501');
      await fails(as(who, `insert into public.${t} default values`), '42501');
    }
  }
});

test('a signed-in stranger sees nothing and can call nothing', async () => {
  for (const t of TABLES.filter(t => t !== 'event_settings')) assert.equal((await as('x', `select * from public.${t}`)).length, 0, t);
  await fails(as('x', 'select * from public.project_wall()'), 'BB403');
  await fails(as('x', "select public.save_my_submission('{}')"), 'BB403');
  await fails(as('x', "select public.submit_review(gen_random_uuid(), 'shortlist', '{}', '')"), 'BB403');
  await fails(as('x', 'select public.admin_overview()'), 'BB403');
});

test('participants and reviewers cannot use any organizer function', async () => {
  const calls = [
    "admin_update_event('{}')", "admin_set_phase('submissions')", "admin_import_roster('[]')", 'admin_set_participant_active(gen_random_uuid(), false)', 'admin_remove_participant(gen_random_uuid())', "admin_set_participant_track(gen_random_uuid(), 'showcase')",
    "admin_set_votes(gen_random_uuid(), 1, 'a long enough reason')", 'admin_vote_counts()',
    "admin_invite_staff('z@q.test', 'organizer')", "admin_revoke_staff('rev@q.test', 'reviewer')", 'admin_set_eligibility(gen_random_uuid(), true, null)',
    'admin_assign_reviewer(gen_random_uuid(), gen_random_uuid())', 'admin_unassign(gen_random_uuid())', 'admin_auto_assign(3)',
    "admin_resolve_submission(gen_random_uuid(), 'shortlisted', 'a reason here')", 'admin_finalize_shortlist()', "admin_emergency_remove(gen_random_uuid(), 'x')",
    'admin_overview()', "admin_invalidate_ballot(gen_random_uuid(), 'x')", "admin_record_award('creative', gen_random_uuid(), 'p', 'r')",
    "admin_record_tie_break(1, '{}', null, true, 'x')", 'admin_publish_results()', 'admin_staff()', 'shortlist_tally()'
  ];
  for (const who of ['a', 'rev']) for (const c of calls) await fails(as(who, `select * from public.${c}`), 'BB403');
});

test('organizers cannot grant themselves extra power or remove their own role', async () => {
  await fails(as('org', "select public.admin_revoke_staff('org@q.test', 'organizer')"), 'BB403');
  await fails(as('org', "select public.admin_invite_staff('a@q.test', 'participant')"), 'BB400');
  await fails(as('org', "select public.admin_invite_staff('not-an-email', 'reviewer')"), 'BB400');
});

test('roster import validates every row', async () => {
  await fails(as('org', 'select public.admin_import_roster($1)', [JSON.stringify([{email: 'ok@q.test', display_name: 'Ok'}, {email: 'broken', display_name: 'X'}])]), 'BB400');
  assert.equal((await db.query("select count(*)::int n from public.participants where email = 'ok@q.test'")).rows[0].n, 0, 'whole import rolls back');
  await fails(as('org', 'select public.admin_import_roster($1)', [JSON.stringify([{email: 'y@q.test', display_name: ''}])]), 'BB400');
  await fails(as('org', "select public.admin_import_roster('{}')"), 'BB400');
  assert.equal((await as('org', 'select public.admin_import_roster($1) n', [JSON.stringify([{email: '  MIXED@Q.test ', display_name: 'Mixed'}])]))[0].n, 1);
  assert.equal((await db.query("select count(*)::int n from public.participants where email = 'mixed@q.test'")).rows[0].n, 1, 'emails are normalized');
});

test('schedule validation and illegal phase jumps', async () => {
  await fails(as('org', 'select public.admin_update_event($1)', [{voting_open_at: at(5), voting_close_at: at(4)}]), 'BB400');
  await fails(as('org', 'select public.admin_update_event($1)', [{starts_at: at(5), ends_at: at(1)}]), 'BB400');
  await fails(as('org', 'select public.admin_update_event($1)', [{submission_deadline: 'tomorrow-ish'}]), 'BB400');
  for (const target of ['review', 'voting', 'closed', 'shortlist_frozen', 'results_published']) {
    await fails(as('org', `select public.admin_set_phase('${target}')`), 'BB403');
  }
  await as('org', 'select public.admin_update_event($1)', [{submission_deadline: at(2)}]);
  await as('org', "select public.admin_set_phase('submissions')");
  await fails(as('org', "select public.admin_set_phase('submissions')"), 'BB403');
});

const sub = {};
test('submission rules: length, links, ownership, deactivation', async () => {
  await fails(as('a', 'select public.save_my_submission($1)', [{title: 'ab', description: 'x'.repeat(30)}]), 'BB400');
  await fails(as('a', 'select public.save_my_submission($1)', [{title: 'Title', description: 'too short'}]), 'BB400');
  await fails(as('a', 'select public.save_my_submission($1)', [{title: 'Title', description: 'x'.repeat(4001)}]), 'BB400');
  await fails(as('a', 'select public.save_my_submission($1)', [{title: 'Title ok', description: 'A description long enough.', repository_url: 'https://example.com/not-a-forge'}]), 'BB400');
  await fails(as('a', 'select public.save_my_submission($1)', [{title: 'Title ok', description: 'A description long enough.', category: 'spaceship'}]), 'BB400');
  for (const k of ['a', 'b', 'c', 'd', 'e']) {
    await as(k, 'select public.save_my_submission($1, true)', [{title: `Project ${k}`, description: 'A finished project with all links.', demo_url: `https://${k}.test`, repository_url: `https://github.com/q/${k}`}]);
    sub[k] = (await as(k, 'select id from public.submissions'))[0].id;
  }
  assert.equal((await as('a', 'select * from public.submissions')).length, 1, 'participants see only their own submission');
  await fails(as('a', "select public.attach_my_cover('someone-else/00000000-0000-4000-8000-000000000000.png')"), 'BB400');
  // A paused participant cannot keep editing.
  const [{id}] = (await db.query("select id from public.participants where email = 'e@q.test'")).rows;
  await as('org', 'select public.admin_set_participant_active($1, false)', [id]);
  await fails(as('e', 'select public.save_my_submission($1)', [{title: 'Edited', description: 'Trying while paused here.'}]), 'BB403');
  await as('org', 'select public.admin_set_participant_active($1, true)', [id]);
});

test('showcase projects stay on the wall but can never compete', async () => {
  await as('org', 'select public.admin_import_roster($1)', [JSON.stringify([{email: 'h@q.test', display_name: 'Hal', track: 'showcase'}])]);
  await fails(as('org', 'select public.admin_import_roster($1)', [JSON.stringify([{email: 'z@q.test', display_name: 'Zed', track: 'judge'}])]), 'BB400');
  await user('h', 'h@q.test'); await as('h', 'select public.project_wall()').catch(() => {});
  await as('h', 'select public.save_my_submission($1, true)', [{title: 'Hal showcase', description: 'A showcase project for everyone to see.', demo_url: 'https://h.test', repository_url: 'https://github.com/q/h'}]);
  sub.h = (await as('h', 'select id from public.submissions'))[0].id;
  const wall = await as('a', 'select title, status from public.project_wall()');
  assert.equal(wall.find(w => w.title === 'Hal showcase')?.status, 'showcase', 'on the wall (the app shows it as a normal project)');
  await fails(as('org', 'select public.admin_set_eligibility($1, true, null)', [sub.h]), 'BB409');
  // Moved into the competition it can be checked; moved back out, it leaves review again.
  const [{id: hid}] = (await db.query("select id from public.participants where email = 'h@q.test'")).rows;
  await as('org', "select public.admin_set_participant_track($1, 'competing')", [hid]);
  await as('org', 'select public.admin_set_eligibility($1, true, null)', [sub.h]);
  await as('org', 'select public.admin_import_roster($1)', [JSON.stringify([{email: 'h@q.test', display_name: 'Hal', track: 'showcase'}])]);
  assert.equal((await db.query('select status from public.submissions where id = $1', [sub.h])).rows[0].status, 'submitted', 'showcase leaves review');
  await as('org', 'select public.admin_import_roster($1)', [JSON.stringify([{email: 'h@q.test', display_name: 'Hal Again'}])]);
  assert.equal((await db.query("select track from public.participants where email = 'h@q.test'")).rows[0].track, 'showcase', 'import without a track keeps it');
  assert.equal((await db.query("select count(*)::int n from public.audit_logs where action = 'participant.track_changed'")).rows[0].n, 2);
});

test('reviews: privacy between reviewers, flag notes, unassign rules', async () => {
  await as('org', "select public.admin_set_phase('review')");
  for (const k of ['a', 'b', 'c', 'd', 'e']) await as('org', 'select public.admin_set_eligibility($1, true, null)', [sub[k]]);
  assert.equal((await as('org', 'select public.admin_auto_assign(3) n'))[0].n, 15);
  await fails(as('org', 'select public.admin_assign_reviewer($1, $2)', [sub.a, ids.a]), 'BB400'); // not a reviewer
  const mine = await as('rev', 'select id, submission_id from public.reviewer_assignments');
  const theirs = await as('rev2', 'select id from public.reviewer_assignments');
  assert.ok(mine.length && theirs.length);
  assert.ok(mine.every(m => !theirs.some(t => t.id === m.id)), 'reviewers only see their own assignments');
  await fails(as('rev', "select public.submit_review($1, 'flag', '{}', 'short')", [mine[0].id]), 'BB400');
  await fails(as('rev', "select public.submit_review($1, 'shortlist', '{\"originality\": 2.5}', '')", [mine[0].id]), 'BB400');
  await fails(as('rev', "select public.submit_review($1, 'shortlist', '{\"vibes\": 5}', '')", [mine[0].id]), 'BB400');
  await as('rev', "select public.submit_review($1, 'shortlist', '{\"originality\": 5}', 'Lovely.')", [mine[0].id]);
  assert.equal((await as('rev2', 'select * from public.reviews')).filter(r => r.assignment_id === mine[0].id).length, 0, 'reviews are private');
  assert.equal((await as('a', 'select * from public.reviews')).length, 0, 'participants never see reviews');
  await fails(as('org', 'select public.admin_unassign($1)', [mine[0].id]), 'BB409');
  // Revising is allowed and audited.
  await as('rev', "select public.submit_review($1, 'reject', '{}', 'Changed my mind.')", [mine[0].id]);
  assert.equal((await db.query("select count(*)::int n from public.audit_logs where action = 'review.revised'")).rows[0].n, 1);
  await fails(as('org', 'select public.admin_revoke_staff($1, $2)', ['rev@q.test', 'reviewer']), 'BB409'); // has assignments
});

test('emergency removal, ballots by role, invalidation guards', async () => {
  const assignments = (await db.query('select a.id, u.email from public.reviewer_assignments a join auth.users u on u.id = a.reviewer_id left join public.reviews r on r.assignment_id = a.id where r.id is null')).rows;
  const keyOf = email => Object.keys(ids).find(k => email.startsWith(k + '@'));
  for (const a of assignments) await as(keyOf(a.email), "select public.submit_review($1, 'shortlist', '{}', '')", [a.id]);
  await as('org', 'select public.admin_finalize_shortlist()');
  await fails(as('org', 'select public.admin_emergency_remove($1, $2)', [sub.e, 'too short']), 'BB400');
  await as('org', 'select public.admin_update_event($1)', [{voting_open_at: at(-1), voting_close_at: at(1)}]);
  const shortlisted = (await as('org', "select submission_id from public.shortlist_tally() where shortlist_status = 'shortlisted'")).map(r => r.submission_id);
  if (shortlisted.length >= 4) {
    await as('org', "select public.admin_set_phase('voting')");
    await fails(as('rev', 'select public.submit_ballot($1)', [shortlisted.slice(0, 3)]), 'BB403');
    await fails(as('org', 'select public.submit_ballot($1)', [shortlisted.slice(0, 3)]), 'BB403');
    await fails(as('org', "select public.admin_invalidate_ballot(gen_random_uuid(), 'A long enough documented reason.')"), 'BB404');
    await fails(as('org', 'select public.admin_publish_results()'), 'BB403'); // voting still open
    await fails(as('org', "select public.admin_record_tie_break(1, $1, null, true, 'Shared by rubric.')", [shortlisted.slice(0, 2)]), 'BB403');
  }
});

test('everyone can save their own display name, and only their own', async () => {
  await fails(as('x', "select public.set_my_name('Stranger')"), 'BB403');
  await fails(as('a', "select public.set_my_name('A')"), 'BB400');
  assert.equal((await as('a', "select public.set_my_name('  Ana   Sharma ') n"))[0].n, 'Ana Sharma');
  assert.equal((await db.query("select display_name from public.participants where email = 'a@q.test'")).rows[0].display_name, 'Ana Sharma', 'roster name follows');
  assert.equal((await db.query("select raw_user_meta_data->>'display_name' n from auth.users where email = 'a@q.test'")).rows[0].n, 'Ana Sharma');
  await as('rev', "select public.set_my_name('Volunteer Ravi')");
  assert.equal((await db.query("select display_name from public.staff_invites where email = 'rev@q.test'")).rows[0].display_name, 'Volunteer Ravi', 'staff name follows');
  assert.equal((await db.query("select display_name from public.participants where email = 'b@q.test'")).rows[0].display_name, 'Ben', 'other people untouched');
});

test('removing a participant takes their project along, but never once votes exist', async () => {
  await fails(as('org', 'select public.admin_remove_participant(gen_random_uuid())'), 'BB404');
  // Someone who never built anything goes straight away.
  await db.exec("insert into public.participants (email, display_name) values ('f@q.test', 'Fay'), ('g@q.test', 'Gus')");
  const pid = async e => (await db.query('select id from public.participants where email = $1', [e])).rows[0].id;
  await as('org', 'select public.admin_remove_participant($1)', [await pid('f@q.test')]);
  // Someone with a reviewed project: project, assignment and review all go, and so does their role.
  await user('g', 'g@q.test'); await as('g', 'select public.project_wall()').catch(() => {});
  const gid = await pid('g@q.test');
  const [{id: gsub}] = (await db.query("insert into public.submissions (participant_id, title, description, status, submitted_at) values ($1, 'Gus project', 'A finished project with all links.', 'draft', null) returning id", [gid])).rows;
  const [{id: asg}] = (await db.query('insert into public.reviewer_assignments (submission_id, reviewer_id) values ($1, $2) returning id', [gsub, ids.rev])).rows;
  await as('org', 'select public.admin_remove_participant($1)', [gid]);
  assert.equal((await db.query('select 1 from public.submissions where id = $1', [gsub])).rows.length, 0, 'project removed');
  assert.equal((await db.query('select 1 from public.reviewer_assignments where id = $1', [asg])).rows.length, 0, 'assignments cascade');
  assert.equal((await db.query("select 1 from public.user_roles where user_id = $1 and role = 'participant'", [ids.g])).rows.length, 0, 'participant role removed');
  assert.equal((await db.query("select count(*)::int n from public.audit_logs where action = 'participant.removed'")).rows[0].n, 2);
  // Voters, and anyone whose project has a vote, stay: deactivate them instead.
  const [{phase}] = (await db.query('select phase from public.event_settings')).rows;
  if (phase === 'voting') {
    const picks = (await as('org', "select t.submission_id from public.shortlist_tally() t join public.submissions s on s.id = t.submission_id join public.participants p on p.id = s.participant_id where t.shortlist_status = 'shortlisted' and p.email <> 'a@q.test'")).map(r => r.submission_id).slice(0, 3);
    await as('a', 'select public.submit_ballot($1)', [picks]);
    await fails(as('org', 'select public.admin_remove_participant($1)', [await pid('a@q.test')]), 'BB409');
    const [{email}] = (await db.query('select p.email from public.submissions s join public.participants p on p.id = s.participant_id where s.id = $1', [picks[0]])).rows;
    await fails(as('org', 'select public.admin_remove_participant($1)', [await pid(email)]), 'BB409');
  }
});

test('organizers can set vote totals by hand, and showcase participants cannot vote', async () => {
  const [{phase}] = (await db.query('select phase from public.event_settings')).rows;
  assert.equal(phase, 'voting', 'earlier tests leave voting open');
  const [{id: hid}] = (await db.query("select id from public.participants where email = 'h@q.test'")).rows;
  await fails(as('org', "select public.admin_set_participant_track($1, 'competing')", [hid]), 'BB403'); // frozen
  assert.equal((await as('h', 'select public.my_voting_status() s'))[0].s.reason, 'showcase');
  const counts = await as('org', 'select * from public.admin_vote_counts()');
  const target = counts[counts.length - 1];
  await fails(as('h', 'select public.submit_ballot($1)', [counts.slice(0, 3).map(c => c.submission_id)]), 'BB403');
  await fails(as('org', "select public.admin_set_votes($1, 10, 'short')", [target.submission_id]), 'BB400');
  await fails(as('org', "select public.admin_set_votes($1, -1, 'a long enough reason')", [target.submission_id]), 'BB400');
  await fails(as('org', "select public.admin_set_votes($1, 5, 'a long enough reason')", [sub.h]), 'BB404');
  await as('org', "select public.admin_set_votes($1, 42, 'Recount of the paper ballots')", [target.submission_id]);
  const after = (await as('org', 'select * from public.admin_vote_counts()')).find(c => c.submission_id === target.submission_id);
  assert.equal(Number(after.total), 42); assert.equal(after.delta, 42 - Number(target.ballots)); assert.equal(after.reason, 'Recount of the paper ballots');
  const results = await as('org', 'select * from public.vote_results()');
  assert.equal(results[0].submission_id, target.submission_id, 'results use the edited total'); assert.equal(Number(results[0].votes), 42);
  await as('org', "select public.admin_set_votes($1, $2, 'Back to the ballot count')", [target.submission_id, Number(target.ballots)]);
  assert.equal((await db.query('select count(*)::int n from public.vote_adjustments')).rows[0].n, 0, 'matching the ballots removes the adjustment');
  assert.equal((await db.query("select count(*)::int n from public.audit_logs where action = 'votes.adjusted'")).rows[0].n, 2);
});

test('votes stay secret: nobody but organizers sees any vote until results are published', async () => {
  // Earlier tests left voting open with at least one ballot cast.
  assert.ok((await db.query('select count(*)::int n from public.ballots')).rows[0].n > 0, 'a ballot exists');
  for (const who of ['a', 'b', 'rev', 'h']) {
    await fails(as(who, 'select * from public.vote_results()'), 'BB403');
    assert.equal((await as(who, 'select * from public.ballot_selections')).length, 0, `${who} sees no picks`);
    assert.equal((await as(who, 'select * from public.vote_adjustments')).length, 0, `${who} sees no adjustments`);
    const ballots = await as(who, 'select participant_id from public.ballots');
    assert.ok(ballots.length <= 1, `${who} sees at most their own ballot`);
    assert.ok((await as(who, 'select standing from public.project_wall()')).every(r => r.standing === null), `${who} sees no standings`);
  }
  assert.equal((await as(null, 'select * from public.public_highlights()')).length, 0, 'landing shows no winners');
  assert.ok((await as('org', 'select * from public.vote_results()')).length > 0, 'organizers can see totals');
});
