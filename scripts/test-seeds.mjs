// Applies schema.sql + seed.sql + seed-test.sql to an in-process Postgres, rehearses the
// event with the seeded accounts, then checks seed-test-cleanup.sql removes only test data.
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const read = name => readFile(new URL('../supabase/' + name, import.meta.url), 'utf8');
const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;`);
await db.exec(await read('schema.sql'));

const ids = {};
async function user(email) {
  ids[email] = randomUUID();
  await db.query('insert into auth.users values ($1, $2, now())', [ids[email], email]);
}
async function as(email, sql, params = []) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[email]]);
  await db.exec('set role authenticated');
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
}
const roles = async email => (await as(email, 'select array_agg(role::text order by role) r from public.user_roles where user_id = auth.uid()'))[0].r ?? [];
const test1 = n => `dy3239073+test${n}@gmail.com`;

test('team seed grants the right roles, before and after first sign-in', async () => {
  await user('dy3239073@gmail.com');          // signed in before the seed ran
  await user('stranger@example.com');
  await db.exec(await read('seed.sql'));
  await db.exec(await read('seed.sql'));       // re-running is safe
  await user('zkavish8@gmail.com');            // signs in after the seed
  await user('naiitik1526@gmail.com');
  assert.deepEqual(await roles('dy3239073@gmail.com'), ['reviewer', 'organizer']);
  assert.deepEqual(await roles('naiitik1526@gmail.com'), ['reviewer', 'organizer']);
  assert.deepEqual(await roles('zkavish8@gmail.com'), ['reviewer']);
  assert.deepEqual(await roles('stranger@example.com'), []);
  assert.equal((await db.query("select count(distinct email)::int n from public.staff_invites")).rows[0].n, 11);
  const [e] = (await db.query("select venue_name, to_char(starts_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') s, extract(epoch from ends_at - starts_at) / 3600 h from public.event_settings")).rows;
  assert.deepEqual([e.venue_name, e.s, Number(e.h)], ['Chandigarh University, Lucknow', '2026-10-23 10:00', 5]);
});

test('test participants can rehearse the whole flow', async () => {
  for (const n of [1, 2, 3, 4, 5]) await user(test1(n));
  await db.exec(await read('seed-test.sql'));
  assert.deepEqual(await roles(test1(1)), ['participant']);
  const org = 'dy3239073@gmail.com';
  // Rehearsal clock: move the schedule around "now" so each phase is open.
  const at = h => new Date(Date.now() + h * 36e5).toISOString();
  await as(org, 'select public.admin_update_event($1)', [{submission_deadline: at(1)}]);
  await as(org, "select public.admin_set_phase('submissions')");
  await as(org, "select public.admin_set_phase('review')");
  const subs = (await as(org, "select id from public.submissions where title like 'TEST%' order by title")).map(r => r.id);
  assert.equal(subs.length, 5);
  for (const id of subs) await as(org, 'select public.admin_set_eligibility($1, true, null)', [id]);
  for (const r of ['qwertyisopofficial@gmail.com', 'kuratus89@gmail.com']) await user(r);
  assert.equal((await as(org, 'select public.admin_auto_assign(3) n'))[0].n, 15);
  const assignments = (await db.query('select a.id, u.email from public.reviewer_assignments a join auth.users u on u.id = a.reviewer_id')).rows;
  for (const a of assignments) await as(a.email, "select public.submit_review($1, 'shortlist', '{}', '')", [a.id]);
  assert.equal((await as(org, 'select public.admin_finalize_shortlist() r'))[0].r.shortlisted, 5);
  await as(org, 'select public.admin_update_event($1)', [{voting_open_at: at(-1), voting_close_at: at(1)}]);
  await as(org, "select public.admin_set_phase('voting')");
  const wall = (await as(test1(1), "select id, is_mine from public.project_wall('', true)")).filter(p => !p.is_mine).map(p => p.id);
  await as(test1(1), 'select public.submit_ballot($1)', [wall.slice(0, 3)]);
  assert.equal((await as(org, 'select sum(votes)::int n from public.vote_results()'))[0].n, 3);
});

test('cleanup removes only test data', async () => {
  await db.query("insert into public.participants (email, display_name) values ('real@example.com', 'Real Person')");
  await db.exec(await read('seed-test-cleanup.sql'));
  const count = async sql => (await db.query(sql)).rows[0].n;
  assert.equal(await count("select count(*)::int n from public.participants where email like 'dy3239073+test%'"), 0);
  assert.equal(await count('select count(*)::int n from public.submissions'), 0);
  assert.equal(await count('select count(*)::int n from public.ballots'), 0);
  assert.equal(await count("select count(*)::int n from public.participants where email = 'real@example.com'"), 1);
  assert.deepEqual(await roles('dy3239073@gmail.com'), ['reviewer', 'organizer']);
  assert.equal(await count("select count(*)::int n from pg_trigger where tgname = 'ballot_selections_append_only' and tgenabled = 'O'"), 1, 'append-only guard is back on');
});
