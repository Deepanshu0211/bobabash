// Event rehearsal on the live Supabase project, driven step by step while you manage
// everything in the portal as an organizer.
//
//   npm run sim -- start     clean slate, rehearsal schedule (open now), 12 simulated submissions
//   npm run sim -- reviews   simulated volunteers finish the reviews on simulated projects
//   npm run sim -- votes     simulated participants cast their ballots
//   npm run sim -- status    where the rehearsal stands
//   npm run sim -- reset     wipe rehearsal activity and restore the real 23 Oct schedule
//
// Simulated people act through the same database functions as real users (their own
// sessions, RLS and all). Only the clean-slate / reset steps use the service key directly.
// Refuses to run once a real roster exists, so it can never touch real event data.
import {createClient} from '@supabase/supabase-js';

try { process.loadEnvFile('.env'); } catch { /* use shell env */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error('Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY in .env');

const svc = createClient(url, serviceKey, {auth: {persistSession: false, autoRefreshToken: false}});
const BASE = 'dy3239073';
const TEST = /^dy3239073\+(test|sim|simrev)\d*@gmail\.com$/;
const simEmail = n => `${BASE}+sim${String(n).padStart(2, '0')}@gmail.com`;
const reviewerEmail = n => `${BASE}+simrev${n}@gmail.com`;

// The real event schedule (IST), restored by `reset`.
const REAL_SCHEDULE = {
  starts_at: '2026-10-23T10:00:00+05:30', submission_deadline: '2026-10-23T13:00:00+05:30', review_deadline: '2026-10-23T13:45:00+05:30',
  voting_open_at: '2026-10-23T13:55:00+05:30', voting_close_at: '2026-10-23T14:40:00+05:30', ends_at: '2026-10-23T15:00:00+05:30'
};

const PROJECTS = [
  ['Aarav', 'Chai Timer', 'A pomodoro timer that brews a cup of chai as you focus. Steeps darker the longer you stay on task.', 'tool'],
  ['Mei', 'Lucknow Food Map', 'A map of the best street food around campus with ratings from students and a "near me" button.', 'website'],
  ['Zoya', 'Pixel Pet', 'A tiny virtual pet that lives in your browser tab and gets hungry if you leave it alone too long.', 'game'],
  ['Kabir', 'Study Buddy Bot', 'A Discord bot that quizzes you on your notes and keeps a streak counter for the whole server.', 'tool'],
  ['Ines', 'Rangoli Generator', 'Generates symmetrical rangoli patterns from a few colours and lets you export them as posters.', 'art'],
  ['Tariq', 'Bus Stop Live', 'Shows when the next campus shuttle arrives using crowd reports from riders at each stop.', 'website'],
  ['Riya', 'Plant Whisperer', 'An ESP32 sensor that tweets when your plant is thirsty and a web dashboard of soil moisture.', 'hardware'],
  ['Noor', 'Typing Thali', 'A typing game where every correct word adds a dish to your thali. Clean plates win.', 'game'],
  ['Sam', 'Lost & Found Board', 'A simple board for campus lost and found with photos, categories and a claim button.', 'website'],
  ['Leo', 'Synth Doodle', 'Draw lines on a canvas and hear them as music. Thicker lines play louder notes.', 'art'],
  ['Ana', 'Hostel Menu', 'This week\'s mess menu with votes for favourite dishes and a dinner countdown.', 'website'],
  ['Dev', 'Shloka Flashcards', 'Spaced repetition flashcards for Sanskrit shlokas with audio and meaning cards.', 'tool']
];
// Recommendations per simulated project: mostly passes, a few fails, one flag for you to resolve.
const REVIEW_PLAN = ['sss', 'ssr', 'sss', 'srs', 'rrs', 'sss', 'ssf', 'rss', 'rrr', 'sss', 'ssr', 'srr'];

// Small deterministic RNG so every rehearsal behaves the same way.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

function check({data, error}, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function guard() {
  const people = check(await svc.from('participants').select('email'), 'participants');
  const real = people.filter(p => !TEST.test(p.email));
  if (real.length) throw new Error(`Refusing to run: ${real.length} real participant(s) are on the roster. The simulator only works before the real roster is imported.`);
}

/** A signed-in client for one simulated person, using a real session (no email is sent). */
async function sessionFor(email) {
  const created = await svc.auth.admin.createUser({email, email_confirm: true});
  if (created.error && created.error.status !== 422) throw new Error(`create ${email}: ${created.error.message}`);
  const link = check(await svc.auth.admin.generateLink({type: 'magiclink', email}), `link ${email}`);
  const client = createClient(url, anonKey, {auth: {persistSession: false, autoRefreshToken: false}});
  check(await client.auth.verifyOtp({type: 'email', token_hash: link.properties.hashed_token}), `session ${email}`);
  return client;
}

async function event() { return check(await svc.from('event_settings').select('*').eq('id', 1).single(), 'event'); }
async function audit(action, details = {}) { await svc.from('audit_logs').insert({actor_id: null, action, target_type: 'event_settings', target_id: '1', details}); }

/** Removes every vote, review, assignment, award and simulated person. Keeps the team and test1..5. */
async function wipeActivity() {
  // ballot_selections are append-only by trigger; cascade through ballots via SQL is blocked too,
  // so remove them with an RPC-free path: delete ballots' selections first via the service key.
  const sels = check(await svc.from('ballot_selections').select('ballot_id'), 'selections');
  if (sels.length) {
    const {error} = await svc.rpc('sim_clear_ballots');
    if (error) throw new Error('Run supabase/patches/2026-10-22-simulation-helpers.sql in the SQL Editor first (' + error.message + ').');
  }
  check(await svc.from('ballots').delete().not('id', 'is', null), 'ballots');
  check(await svc.from('result_decisions').delete().not('id', 'is', null), 'decisions');
  check(await svc.from('awards').delete().not('id', 'is', null), 'awards');
  check(await svc.from('reviewer_assignments').delete().not('id', 'is', null), 'assignments'); // cascades reviews
  const sims = check(await svc.from('participants').select('id').like('email', `${BASE}+sim%`), 'sim people');
  if (sims.length) {
    check(await svc.from('submissions').delete().in('participant_id', sims.map(s => s.id)), 'sim submissions');
    check(await svc.from('participants').delete().in('id', sims.map(s => s.id)), 'sim participants');
  }
  // Test participants start blank: their rehearsal projects (and covers) go, and they are reactivated.
  check(await svc.from('participants').update({active: true}).like('email', `${BASE}+test%`), 'reactivate');
  const tests = check(await svc.from('participants').select('id').like('email', `${BASE}+test%`), 'tests');
  if (tests.length) {
    const own = check(await svc.from('submissions').select('cover_image_path').in('participant_id', tests.map(t => t.id)), 'test projects');
    const covers = own.map(o => o.cover_image_path).filter(Boolean);
    if (covers.length) await svc.storage.from('project-covers').remove(covers);
    check(await svc.from('submissions').delete().in('participant_id', tests.map(t => t.id)), 'delete test projects');
  }
}

const TESTERS = [1, 2, 3].map(n => ({email: `${BASE}+test${n}@gmail.com`, display_name: `Test Participant ${n}`, active: true}));

async function start() {
  await guard();
  await wipeActivity();
  const now = Date.now();
  const iso = m => new Date(now + m * 60_000).toISOString();
  // Rehearsal schedule: everything stays open for the next 4 hours.
  check(await svc.from('event_settings').update({
    phase: 'submissions', starts_at: iso(-5), submission_deadline: iso(240), review_deadline: iso(240),
    voting_open_at: iso(-5), voting_close_at: iso(240), ends_at: iso(245),
    shortlist_finalized_at: null, results_published_at: null, name: 'Boba Bash Lucknow (rehearsal)'
  }).eq('id', 1), 'schedule');

  // Simulated volunteers (separate test accounts, never the real team).
  for (const n of [1, 2, 3]) {
    check(await svc.from('staff_invites').upsert({email: reviewerEmail(n), role: 'reviewer', display_name: `Sim Volunteer ${n}`}), 'invite');
    await sessionFor(reviewerEmail(n)); // creates the account; the auth trigger grants the role
  }
  // Blank participants for you to play as: sign in with these and submit your own project.
  check(await svc.from('participants').upsert(TESTERS, {onConflict: 'email'}), 'testers');
  for (const t of TESTERS) await sessionFor(t.email); // creates the account; the auth trigger links the role
  // Simulated participants submit through the real function, as themselves.
  check(await svc.from('participants').upsert(PROJECTS.map(([name], i) => ({email: simEmail(i + 1), display_name: `${name} (sim)`, active: true})), {onConflict: 'email'}), 'roster');
  for (const [i, [name, title, description, category]] of PROJECTS.entries()) {
    const db = await sessionFor(simEmail(i + 1));
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    check(await db.rpc('save_my_submission', {submit: true, payload: {title, description, category,
      demo_url: `https://example.com/${slug}`, repository_url: `https://github.com/hackclub/${slug}`}}), `submit ${title}`);
    process.stdout.write(`  ✓ ${name} submitted "${title}"\n`);
  }
  await audit('simulation.start', {participants: PROJECTS.length, reviewers: 3});
  console.log(`
Rehearsal ready. Phase: submissions (open until you move on).
Play as a participant (sign in with no code):
  ${TESTERS.map(t => t.email).join(', ')}
  → My submission: save a draft, add a cover, submit. Check the project wall.
Then as organizer:
  1. Submissions → mark projects eligible (yours too; try marking one ineligible with a reason).
  2. Overview → move to "Volunteer review".
  3. Reviews → Auto-assign reviewers.
Then run: npm run sim -- reviews`);
}

async function reviews() {
  await guard();
  const ev = await event();
  if (ev.phase !== 'review') throw new Error(`Phase is "${ev.phase}". Move to "Volunteer review" and auto-assign first.`);
  const subs = check(await svc.from('submissions').select('id, title, status, participants!inner(email)').like('participants.email', `${BASE}+%`).eq('status', 'eligible'), 'eligible projects');
  if (!subs.length) throw new Error('No eligible projects. Mark some eligible on the Submissions page first.');
  const simReviewers = [];
  for (const n of [1, 2, 3]) {
    const db = await sessionFor(reviewerEmail(n));
    const {data: {user}} = await db.auth.getUser();
    simReviewers.push({n, db, id: user.id});
  }
  // Simulated volunteers take over unreviewed assignments on rehearsal projects, so the
  // real team's accounts never get reviews written for them.
  for (const s of subs) {
    const existing = check(await svc.from('reviewer_assignments').select('id, reviewer_id, reviews(id)').eq('submission_id', s.id), 'assignments');
    for (const a of existing) if (!a.reviews && !simReviewers.some(r => r.id === a.reviewer_id)) check(await svc.from('reviewer_assignments').delete().eq('id', a.id), 'hand over');
    for (const r of simReviewers) {
      check(await svc.from('reviewer_assignments').upsert({submission_id: s.id, reviewer_id: r.id, status: 'assigned'}, {onConflict: 'submission_id,reviewer_id', ignoreDuplicates: true}), 'assign');
    }
  }
  let i = 0;
  for (const s of subs) {
    const plan = REVIEW_PLAN[i++ % REVIEW_PLAN.length];
    for (const [k, r] of simReviewers.entries()) {
      const {data: a} = await r.db.from('reviewer_assignments').select('id, reviews(id)').eq('submission_id', s.id).single();
      if (!a || a.reviews) continue;
      const rec = {s: 'shortlist', r: 'reject', f: 'flag'}[plan[k]];
      check(await r.db.rpc('submit_review', {assignment_id: a.id, recommendation: rec,
        criteria: {functionality: 3 + (k % 3), originality: 2 + ((i + k) % 4), presentation: 4, effort: 3 + (i % 3)},
        note: rec === 'flag' ? 'Looks very close to an existing template. Please check originality.' : rec === 'reject' ? 'Demo did not load for me.' : 'Nice work!'}), `review ${s.title}`);
    }
    process.stdout.write(`  ✓ "${s.title}" reviewed: ${plan.split('').map(c => ({s: '✓', r: '✕', f: '⚑'})[c]).join(' ')}\n`);
  }
  await audit('simulation.reviews', {projects: subs.length});
  console.log(`
Reviews done. Your turn:
  1. Shortlist → look at the tally. Resolve the flagged project (record an exception with a reason).
  2. Finalize & freeze the shortlist (type FINALIZE).
  3. Voting → Open voting (type VOTING).
Then run: npm run sim -- votes   (and vote yourself as dy3239073+test1@gmail.com etc.)`);
}

async function votes() {
  await guard();
  const ev = await event();
  if (ev.phase !== 'voting') throw new Error(`Phase is "${ev.phase}". Open voting first.`);
  const sims = check(await svc.from('participants').select('id, email, display_name').like('email', `${BASE}+sim%`).not('email', 'like', `${BASE}+simrev%`), 'voters');
  let cast = 0;
  for (const p of sims) {
    const db = await sessionFor(p.email);
    const wall = check(await db.rpc('project_wall', {search: '', shortlisted_only: true, page_size: 100, page_offset: 0}), 'shortlist');
    const options = wall.filter(w => !w.is_mine);
    if (options.length < 3) throw new Error('Fewer than 3 shortlisted projects to vote for.');
    // Popularity skew so the rehearsal produces a clear winner and a likely tie further down.
    const weighted = options.flatMap((o, i) => Array(Math.max(1, 5 - i)).fill(o.id));
    const choice = new Set();
    while (choice.size < 3) choice.add(weighted[Math.floor(rand() * weighted.length)]);
    const {error} = await db.rpc('submit_ballot', {selections: [...choice]});
    if (error && !/already submitted/.test(error.message)) throw new Error(`${p.display_name}: ${error.message}`);
    if (!error) { cast++; process.stdout.write(`  ✓ ${p.display_name} voted\n`); }
  }
  await audit('simulation.votes', {ballots: cast});
  console.log(`
${cast} simulated ballots cast. Your turn:
  1. Vote as the test participants (dy3239073+test1@gmail.com, +test3, +test4) to try the booth yourself.
  2. Results & awards → check restricted totals; Voting → try invalidating one ballot with a reason.
  3. Close voting, record both awards and any tie-break, then Publish (type PUBLISH).
  4. When you're done: npm run sim -- reset`);
}

async function status() {
  const ev = await event();
  const count = async (t, q = x => x) => (await q(svc.from(t).select('*', {count: 'exact', head: true}))).count;
  console.log({phase: ev.phase, name: ev.name,
    participants: await count('participants'), submissions: await count('submissions'),
    eligible: await count('submissions', q => q.eq('status', 'eligible')), shortlisted: await count('submissions', q => q.eq('shortlist_status', 'shortlisted')),
    assignments: await count('reviewer_assignments'), reviews: await count('reviews'), ballots: await count('ballots'), awards: await count('awards')});
}

async function reset() {
  await guard();
  await wipeActivity();
  // Remove the blank test participants as well, so the roster is back to the real one.
  const tests = check(await svc.from('participants').select('id, user_id').like('email', `${BASE}+test%`), 'tests');
  if (tests.length) {
    const users = tests.map(t => t.user_id).filter(Boolean);
    if (users.length) check(await svc.from('user_roles').delete().in('user_id', users).eq('role', 'participant'), 'tester roles');
    check(await svc.from('participants').delete().in('id', tests.map(t => t.id)), 'testers');
  }
  for (const n of [1, 2, 3]) {
    check(await svc.from('staff_invites').delete().eq('email', reviewerEmail(n)), 'remove sim reviewer');
    const {data} = await svc.auth.admin.listUsers({perPage: 1000});
    const u = data?.users.find(x => x.email === reviewerEmail(n));
    if (u) check(await svc.from('user_roles').delete().eq('user_id', u.id), 'sim reviewer role');
  }
  check(await svc.from('event_settings').update({phase: 'setup', ...REAL_SCHEDULE, shortlist_finalized_at: null, results_published_at: null, name: 'Boba Bash Lucknow'}).eq('id', 1), 'restore');
  await audit('simulation.reset');
  console.log('Reset done. Phase: setup. Only your real team remains; all test and simulated people are gone.');
}

const commands = {start, reviews, votes, status, reset};
const command = process.argv[2];
if (!commands[command]) { console.log('Usage: npm run sim -- start | reviews | votes | status | reset'); process.exit(1); }
commands[command]().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
