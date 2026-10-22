// Runs supabase/schema.sql inside an in-process PostgreSQL (PGlite) with a minimal
// Supabase auth shim, then exercises the security rules as real database roles.
// No external database or network access is needed: `npm run test:database`.
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const shim = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
`;

const db = new PGlite();
await db.exec(shim);
await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));

const people = {};
async function createUser(key, email, confirmed = true) {
  const id = randomUUID();
  await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)', [id, email, confirmed ? new Date() : null]);
  people[key] = id;
  return id;
}
/** Run SQL as an authenticated user (or anon when key is null), the way PostgREST does. */
async function as(key, sql, params = []) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [key ? people[key] : '']);
  await db.exec(key ? 'set role authenticated' : 'set role anon');
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
}
async function fails(promise, code) {
  await assert.rejects(promise, error => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}
const sub = {};
async function submissionOf(key) {
  const [row] = await as(key, 'select id from public.submissions');
  return row.id;
}

test('identity linking and roles', async () => {
  await db.query("insert into public.staff_invites (email, role) values ('org@bash.test', 'organizer')");
  for (const n of [1, 2, 3, 4]) await db.query("insert into public.staff_invites (email, role) values ($1, 'reviewer')", [`rev${n}@bash.test`]);
  await createUser('org', 'org@bash.test');
  for (const n of [1, 2, 3, 4]) await createUser('rev' + n, `rev${n}@bash.test`);
  await createUser('p6', 'P6@Bash.test'); // signed in before the roster import
  await createUser('outsider', 'stranger@elsewhere.test');

  const roster = [1, 2, 3, 4, 5, 6, 7].map(n => ({email: `p${n}@bash.test`, display_name: `Builder ${n}`}));
  assert.deepEqual(await as('org', 'select public.admin_import_roster($1) as n', [JSON.stringify(roster)]), [{n: 7}]);
  for (const n of [1, 2, 3, 4, 5]) await createUser('p' + n, `p${n}@bash.test`);
  await createUser('p7', 'p7@bash.test', false); // unverified

  const [{roles}] = await as('p6', 'select array_agg(role::text) as roles from public.user_roles');
  assert.deepEqual(roles, ['participant'], 'existing account linked by the roster import');
  assert.deepEqual(await as('outsider', 'select * from public.user_roles'), []);
  await fails(as('outsider', 'select * from public.project_wall()'), 'BB403');
  await fails(as('p7', 'select * from public.project_wall()'), 'BB403');
  await fails(as('p1', "insert into public.user_roles (user_id, role) values (auth.uid(), 'organizer')"), '42501');
  await fails(as('p1', 'select public.admin_overview()'), 'BB403');
  assert.equal((await as('p1', 'select * from public.participants')).length, 1, 'participants only see their own roster row');
});

test('submissions', async () => {
  await fails(as('p1', 'select public.save_my_submission($1)', [{title: 'Too early', description: 'x'.repeat(30)}]), 'BB403');
  // Manual control: organizers open submissions whenever they choose; no deadline needed.
  await as('org', "select public.admin_set_phase('submissions')");

  await fails(as('p1', 'select public.save_my_submission($1, true)', [{title: 'Boba Garden', description: 'A cosy garden you grow with bubble tea.'}]), 'BB400');
  await fails(as('p1', 'select public.save_my_submission($1, true)', [{title: 'Boba Garden', description: 'A cosy garden you grow with bubble tea.', demo_url: 'http://insecure.test', repository_url: 'https://github.com/a/b'}]), 'BB400');
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await as('p' + n, 'select public.save_my_submission($1)', [{title: `Project ${n}`, description: 'A draft that will become something lovely.'}]);
    await as('p' + n, 'select public.save_my_submission($1, true)', [{title: `Project ${n}`, description: 'A finished little website with plenty of charm.', demo_url: `https://p${n}.example.test`, repository_url: `https://github.com/bash/p${n}`, category: 'website'}]);
    sub['p' + n] = await submissionOf('p' + n);
  }
  assert.equal((await db.query('select count(*)::int as n from public.submissions')).rows[0].n, 6, 'one submission per participant');
  await fails(as('p1', "insert into public.submissions (participant_id, title, description) select id, 'Second', 'Another one for the road please' from public.participants"), '42501');
  await fails(as('p1', "update public.submissions set status = 'eligible'"), '42501');
  assert.equal((await as('p2', 'select * from public.submissions where id = $1', [sub.p1])).length, 0, 'cannot read other drafts');

  for (const n of [1, 2, 3, 4, 5]) await as('org', 'select public.admin_set_eligibility($1, true, null)', [sub['p' + n]]);
  await fails(as('org', 'select public.admin_set_eligibility($1, false, $2)', [sub.p6, 'no']), 'BB400');
  await as('org', 'select public.admin_set_eligibility($1, false, $2)', [sub.p6, 'Built before the event started.']);
  await fails(as('p1', 'select public.save_my_submission($1)', [{title: 'Edit after check', description: 'Trying to sneak in a change.'}]), 'BB403');
});

test('reviews and majority shortlist', async () => {
  await as('org', "select public.admin_set_phase('review')");
  const [{n}] = await as('org', 'select public.admin_auto_assign(3) as n');
  assert.equal(n, 15, 'five eligible projects × three reviewers');
  const loads = (await db.query('select count(*)::int as n from public.reviewer_assignments group by reviewer_id order by 1')).rows.map(r => r.n);
  assert.ok(Math.max(...loads) - Math.min(...loads) <= 1, 'balanced workload ' + loads);

  const plan = {p1: ['shortlist', 'shortlist', 'reject'], p2: ['shortlist', 'shortlist', 'shortlist'], p3: ['reject', 'reject', 'shortlist'], p4: ['shortlist', 'shortlist', 'shortlist'], p5: ['shortlist', 'reject', 'flag']};
  const assignments = (await db.query('select a.id, a.reviewer_id, a.submission_id from public.reviewer_assignments a order by a.submission_id, a.reviewer_id')).rows;
  const reviewerKey = id => Object.keys(people).find(k => people[k] === id);

  const foreign = assignments.find(a => a.reviewer_id !== people.rev1);
  await fails(as('rev1', "select public.submit_review($1, 'shortlist', '{}', '')", [foreign.id]), 'BB404');
  const visible = await as('rev1', 'select id from public.submissions');
  assert.ok(visible.every(v => assignments.some(a => a.reviewer_id === people.rev1 && a.submission_id === v.id)), 'reviewer sees assigned projects only');
  await fails(as('rev1', "select public.submit_review($1, 'shortlist', '{\"originality\": 9}', '')", [assignments.find(a => a.reviewer_id === people.rev1).id]), 'BB400');

  // Complete all but one review: finalization must refuse pending projects.
  const owner = Object.fromEntries(Object.entries(sub).map(([k, v]) => [v, k]));
  const counters = {};
  const queue = assignments.map(a => {
    const key = owner[a.submission_id];
    counters[key] = (counters[key] ?? 0) + 1;
    return {...a, recommendation: plan[key][counters[key] - 1]};
  });
  const last = queue.pop();
  for (const a of queue) {
    await as(reviewerKey(a.reviewer_id), 'select public.submit_review($1, $2, $3, $4)', [a.id, a.recommendation, {functionality: 4, originality: 3}, a.recommendation === 'flag' ? 'Looks like a template copy.' : '']);
  }
  await fails(as('org', 'select public.admin_finalize_shortlist()'), 'BB409');
  await as(reviewerKey(last.reviewer_id), 'select public.submit_review($1, $2, $3, $4)', [last.id, last.recommendation, {effort: 5}, last.recommendation === 'flag' ? 'Looks like a template copy.' : '']);

  const tally = Object.fromEntries((await as('org', 'select submission_id, outcome from public.shortlist_tally()')).map(r => [owner[r.submission_id], r.outcome]));
  assert.deepEqual(tally, {p1: 'pass', p2: 'pass', p3: 'fail', p4: 'pass', p5: 'flagged'});
  await fails(as('org', 'select public.admin_finalize_shortlist()'), 'BB409');
  await fails(as('org', "select public.admin_resolve_submission($1, 'shortlisted', 'ok')", [sub.p5]), 'BB400');
  await as('org', "select public.admin_resolve_submission($1, 'shortlisted', 'Original work confirmed with the author.')", [sub.p5]);
  const [{admin_finalize_shortlist: result}] = await as('org', 'select public.admin_finalize_shortlist()');
  assert.equal(result.shortlisted, 4);
  await fails(as('rev1', "select public.submit_review($1, 'reject', '{}', '')", [assignments.find(a => a.reviewer_id === people.rev1).id]), 'BB403');
});

test('ballots', async () => {
  // Manual control: voting opens when an organizer opens it, with or without planned times.
  await as('org', "select public.admin_set_phase('voting')");

  const wall = await as('p3', 'select id, is_shortlisted from public.project_wall(\'\', true)');
  assert.equal(wall.length, 4);

  await fails(as(null, 'select public.submit_ballot($1)', [[sub.p2, sub.p4, sub.p5]]), '42501');
  await fails(as('p1', 'select public.submit_ballot($1)', [[sub.p2, sub.p4]]), 'BB400');
  await fails(as('p1', 'select public.submit_ballot($1)', [[sub.p2, sub.p2, sub.p4]]), 'BB400');
  await fails(as('p1', 'select public.submit_ballot($1)', [[sub.p1, sub.p2, sub.p4]]), 'BB422');
  await fails(as('p1', 'select public.submit_ballot($1)', [[sub.p3, sub.p2, sub.p4]]), 'BB422');
  await fails(as('p1', 'select public.submit_ballot($1)', [[sub.p6, sub.p2, sub.p4]]), 'BB422');
  await fails(as('rev1', 'select public.submit_ballot($1)', [[sub.p2, sub.p4, sub.p5]]), 'BB403');
  assert.equal((await db.query('select count(*)::int as n from public.ballots')).rows[0].n, 0, 'failed attempts leave nothing behind');

  await as('p1', 'select public.submit_ballot($1)', [[sub.p2, sub.p4, sub.p5]]);
  await fails(as('p1', 'select public.submit_ballot($1)', [[sub.p2, sub.p4, sub.p5]]), 'BB409');
  await fails(db.query('insert into public.ballots (participant_id) select participant_id from public.ballots'), '23505');
  await as('p3', 'select public.submit_ballot($1)', [[sub.p1, sub.p2, sub.p4]]);
  await as('p6', 'select public.submit_ballot($1)', [[sub.p1, sub.p2, sub.p5]]);
  await fails(as('p1', "insert into public.ballot_selections select id, $1 from public.ballots", [sub.p1]), '42501');

  assert.equal((await as('p1', 'select * from public.ballot_selections')).length, 0, 'no raw selections for participants');
  assert.equal((await as('p1', 'select * from public.ballots')).length, 1, 'own ballot status only');
  const [{my_ballot_receipt: receipt}] = await as('p1', 'select public.my_ballot_receipt()');
  assert.equal(receipt.selections.length, 3);
  await fails(as('p1', 'select * from public.vote_results()'), 'BB403');
  const live = await as('org', 'select submission_id, votes::int from public.vote_results()');
  assert.equal(live.find(r => r.submission_id === sub.p2).votes, 3);
  assert.equal((await as('p1', "select * from public.audit_logs")).length, 0);
  const [{details}] = await as('org', "select details from public.audit_logs where action = 'ballot.submitted' limit 1");
  assert.deepEqual(details, {selection_count: 3}, 'audit never records choices');

  const [{id: ballot}] = await db.query('select b.id from public.ballots b join public.participants p on p.id = b.participant_id where p.user_id = $1', [people.p6]).then(r => r.rows);
  await fails(as('org', 'select public.admin_invalidate_ballot($1, $2)', [ballot, 'friend']), 'BB400');
  await as('org', 'select public.admin_invalidate_ballot($1, $2)', [ballot, 'Rule 4.2: submitted from a shared account (incident #3).']);
  const after = await as('org', 'select submission_id, votes::int from public.vote_results()');
  assert.equal(after.find(r => r.submission_id === sub.p2).votes, 2, 'invalidated ballots do not count');
  assert.equal(after.find(r => r.submission_id === sub.p5).votes, 1);
  await fails(as('p6', 'select public.submit_ballot($1)', [[sub.p1, sub.p2, sub.p4]]), 'BB409');

  // The planned close time passing does not shut the booth; only an organizer does.
  await as('org', 'select public.admin_update_event($1)', [{voting_close_at: new Date(Date.now() - 1000).toISOString()}]);
  await as('p4', 'select public.submit_ballot($1)', [[sub.p1, sub.p2, sub.p5]]);
});

test('results, awards and audit', async () => {
  await fails(as('org', 'select public.admin_publish_results()'), 'BB403');
  await as('org', "select public.admin_set_phase('closed')");
  assert.deepEqual(await as(null, 'select * from public.public_highlights()'), [], 'nothing public before publication');
  await as('org', "select public.admin_set_phase('voting')"); // organizers can reopen
  await as('org', "select public.admin_set_phase('closed')");
  await fails(as('p5', 'select public.submit_ballot($1)', [[sub.p1, sub.p2, sub.p4]]), 'BB403');
  await as('org', "select public.admin_record_award('creative', $1, 'Organizer panel', 'Most playful use of the theme.')", [sub.p3]);
  await fails(as('org', "select public.admin_record_award('best_github', $1, 'Organizer panel', 'Clean repository.')", [sub.p6]), 'BB422');
  assert.equal((await as('p1', 'select * from public.awards')).length, 0, 'unpublished awards hidden');
  await as('org', 'select public.admin_record_tie_break(2, $1, null, true, $2)', [[sub.p1, sub.p4], 'Shared second place per published tie policy.']);
  await as('org', 'select public.admin_publish_results()');
  assert.equal((await as('p1', 'select * from public.vote_results()')).length, 4);
  assert.equal((await as('p1', 'select * from public.awards')).length, 1);
  await fails(as('org', "select public.admin_set_phase('voting')"), 'BB403');
  await fails(db.query("update public.audit_logs set action = 'tampered'"), 'BB403');
  const actions = (await db.query('select distinct action from public.audit_logs')).rows.map(r => r.action);
  for (const a of ['event.phase_changed', 'shortlist.finalized', 'ballot.invalidated', 'results.published', 'shortlist.exception']) assert.ok(actions.includes(a), a);
});

test('landing winners are public only after publication; organizers see every pick', async () => {
  const hl = await as(null, 'select kind, place, title, votes::int from public.public_highlights() order by kind, place');
  assert.ok(hl.some(h => h.kind === 'place' && h.place === 1 && h.title === 'Project 2'), 'winner visible to anonymous visitors');
  assert.ok(hl.some(h => h.kind === 'creative' && h.title === 'Project 3'), 'judged award visible');
  const picks = await as('org', 'select count(*)::int n from public.ballot_selections');
  assert.ok(picks[0].n >= 9, 'organizers can read every ballot selection');
  assert.equal((await as('p1', 'select * from public.ballot_selections')).length, 0, 'participants still cannot');
});

test('project wall shows every submitted project with its state, medals and awards', async () => {
  const wall = await as('p1', 'select title, status, is_shortlisted, standing, prizes from public.project_wall($1, false, 100)', ['']);
  const by = Object.fromEntries(wall.map(w => [w.title, w]));
  assert.equal(wall.length, 6, 'all six projects, including the ineligible one');
  assert.equal(by['Project 6'].status, 'ineligible');
  assert.equal(by['Project 3'].is_shortlisted, false);
  assert.deepEqual(by['Project 3'].prizes, ['creative'], 'published award shows');
  assert.equal(by['Project 2'].standing, 1, 'winner carries a medal after publication');
  assert.equal(wall[0].title, 'Project 2', 'medal winners lead the wall');
  const winners = await as('p1', "select title from public.project_wall('', false, 100, 0, null, 'winners')");
  assert.ok(winners.length >= 2 && winners.every(w => wall.find(x => x.title === w.title).standing || wall.find(x => x.title === w.title).prizes));
  assert.equal((await as('p1', "select * from public.project_wall('', false, 100, 0, null, 'eligible')")).length, 5);
});

test('unchecked submissions show; drafts and withdrawn stay private; no medals before publication', async () => {
  await db.exec("update public.event_settings set phase = 'submissions', submission_deadline = now() + interval '1 hour' where id = 1");
  await createUser('p9', 'p9@bash.test');
  await createUser('p10', 'p10@bash.test');
  await as('org', 'select public.admin_import_roster($1)', [JSON.stringify([{email: 'p9@bash.test', display_name: 'Nine'}, {email: 'p10@bash.test', display_name: 'Ten'}])]);
  await as('p9', 'select public.save_my_submission($1, true)', [{title: 'Fresh submission', description: 'Submitted and not yet checked.', demo_url: 'https://n.test', repository_url: 'https://github.com/n/n'}]);
  await as('p10', 'select public.save_my_submission($1)', [{title: 'Secret draft', description: 'Still a draft, should stay private.'}]);
  const titles = (await as('p1', "select title, status, standing from public.project_wall('', false, 100)"));
  assert.equal(titles.find(t => t.title === 'Fresh submission')?.status, 'submitted');
  assert.equal(titles.find(t => t.title === 'Secret draft'), undefined);
  assert.ok(titles.every(t => t.standing === null), 'no medals outside results_published');
  await db.exec("update public.event_settings set phase = 'results_published' where id = 1");
});

test('withdrawn participant can start over only while submissions are open', async () => {
  // Fresh, isolated event state for this check.
  await db.exec("update public.event_settings set phase = 'submissions', submission_deadline = now() + interval '1 hour', results_published_at = null where id = 1");
  await createUser('p8', 'p8@bash.test');
  await as('org', 'select public.admin_import_roster($1)', [JSON.stringify([{email: 'p8@bash.test', display_name: 'Builder 8'}])]);
  const first = (await as('p8', 'select public.save_my_submission($1, true) id', [{title: 'First idea', description: 'The first attempt at something fun.', demo_url: 'https://a.test', repository_url: 'https://github.com/a/b'}]))[0].id;
  await as('p8', 'select public.withdraw_my_submission($1)', ['changed my mind']);
  const again = (await as('p8', 'select public.save_my_submission($1) id', [{title: 'Second idea', description: 'A brand new project after withdrawing.'}]))[0].id;
  assert.equal(again, first, 'same single slot is reused');
  const [row] = await as('p8', 'select title, status, cover_image_path from public.submissions');
  assert.deepEqual(row, {title: 'Second idea', status: 'draft', cover_image_path: null});
  await as('p8', 'select public.withdraw_my_submission($1)', ['again']);
  // A passed deadline alone changes nothing; once organizers move to review, it is final.
  await db.exec("update public.event_settings set submission_deadline = now() - interval '1 minute' where id = 1");
  await as('p8', 'select public.save_my_submission($1)', [{title: 'Third idea', description: 'Still allowed while the phase is open.'}]);
  await db.exec("update public.event_settings set phase = 'review' where id = 1");
  await fails(as('p8', 'select public.save_my_submission($1)', [{title: 'Too late', description: 'After organizers closed submissions.'}]), 'BB403');
});
