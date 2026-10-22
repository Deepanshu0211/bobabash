# Boba Bash — event voting portal

Next.js (App Router) + TypeScript + Tailwind, Supabase Auth + PostgreSQL + RLS, deployable to Vercel.
The UI reuses the original Boba Bash artwork and window/paper visual language.

**The frontend never decides who can vote, which projects are eligible, or how many votes a project has.**
Every one of those decisions is enforced in PostgreSQL (`supabase/schema.sql`) by RLS and
`SECURITY DEFINER` functions; the React UI only mirrors them for friendly messages.

> Note: the plan named Vite. This repository was already a Next.js app on Vercel, so the portal is
> built there: same React/TypeScript/Tailwind stack, with server components and route handlers
> acting as the "trusted backend" in front of the database functions.

## Event rules implemented

| Rule | Where it is enforced |
| --- | --- |
| Only verified roster emails participate | `participants` allowlist, `private.link_identity` trigger on `auth.users`, `private.verified()` in every role check |
| One submission per participant | `submissions.participant_id UNIQUE`, `save_my_submission()` |
| Three independent reviews per project | `admin_auto_assign(3)` (balanced, never a reviewer's own project), `UNIQUE(submission_id, reviewer_id)`, `reviews.assignment_id UNIQUE` |
| Strict volunteer majority; missing reviews are pending; flags held | `private.majority_outcome()`, `shortlist_tally()`, `admin_finalize_shortlist()` refuses while anything is pending/flagged without a documented exception |
| Shortlist frozen before voting | `admin_finalize_shortlist()` → phase `shortlist_frozen`; only `admin_emergency_remove()` (logged, 20+ char reason) afterwards |
| Exactly 3 distinct shortlisted projects, no self-vote, one final ballot, voting window only | `submit_ballot()` in one transaction; `ballots.participant_id UNIQUE` is the final race-safe guard |
| Hidden leaderboard | `vote_results()` → organizers only once voting starts, everyone only after `results_published` |
| Totals from valid ballots only | `vote_results()` counts `ballots.id` with `status = 'valid'` (invalidated ballots stay on record) |
| Judged Creative / Best GitHub awards | `awards` table, separate from tallies; published with results |
| Ties documented | `result_decisions` + audit log via `admin_record_tie_break()` |
| Audit trail | `audit_logs` (append-only trigger). Ballot entries never record choices |

## Run locally

Node 22.12+ (24 recommended).

```bash
npm install
npm test               # unit tests (rules, redirects, uploads)
npm run test:database  # runs the real schema in in-process Postgres (PGlite) — no setup needed
npm run typecheck
npm run lint
npm run build
```

### Direct entry (no sign-in email)

With `SUPABASE_SERVICE_ROLE_KEY` set (server-only), a registered email enters the portal directly:
the server checks the roster and opens the session itself, and no email is sent. **Trade-off accepted by
the organizers: anyone who knows a registered email can sign in as that person.** Volunteer and organizer
emails get a second step asking for `ORGANIZER_ACCESS_CODE`, the team code (without it, organizers get an emailed link), and `EVENT_ACCESS_CODE`, if set, is
required from everyone. Without the service key, sign-in falls back to the emailed link.

### Access gate

`src/proxy.ts` (Next.js 16's middleware) runs before every portal page and `/api` route. It lets a
request through only when the account is signed in, has a verified email, and holds a role on the
roster. Each area also needs its role: `/admin` → organizer, `/reviewer` → reviewer,
`/submission` and `/voting` → participant. Pages redirect to `/login`; API routes get 401/403 JSON.
Without Supabase configured, every portal route is closed. The database still re-checks everything.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key — safe in the browser only because of RLS |
| `NEXT_PUBLIC_SITE_URL` | Exact origin, used for magic-link redirects |
| `NEXT_PUBLIC_COMMUNITY_URL` | Optional HTTPS community link |

The service-role key is used only by the direct-entry sign-in (`src/lib/supabase/admin.ts`, server-only). Never put one (or the DB password) in `NEXT_PUBLIC_*` or Git.

## Database setup (fresh Supabase project)

1. `node scripts/create-migration.mjs` copies `supabase/schema.sql` into a CLI-created migration. Review it, apply to a local Supabase, then `supabase db push`.
2. Expose only the `public` schema in the Data API. `private` must stay unexposed.
3. Auth: enable email (magic link / OTP) with confirmation and production SMTP. Site URL = production origin; allow `https://YOUR_DOMAIN/auth/callback`.
4. Bootstrap the first organizer in the SQL editor (the only trusted path):
   ```sql
   insert into public.staff_invites (email, role) values ('lead@example.com', 'organizer');
   ```
   They sign in at `/login`; the trigger grants the role. Then use **Organizer → People** to import the 84-row roster (`email, name` per line) and invite ~10 volunteers.
5. Optionally regenerate types: `npx supabase gen types typescript --project-id REF --schema public`.

## Seeding this event

Run these in Supabase → SQL Editor (they need the trusted role):

1. `supabase/seed.sql` sets the event (Boba Bash Lucknow, Chandigarh University Lucknow, 23 Oct 2026, 10:00 to 15:00 IST placeholder times) and the 11-person team. Co Organizers and Tech are organizers + reviewers; everyone else is a reviewer. Safe to re-run.
2. Optional rehearsal: `supabase/seed-test.sql` adds 5 test participants (`dy3239073+test1..5@gmail.com`, all delivered to one inbox) with one submitted test project each.
3. Before the real event: `supabase/seed-test-cleanup.sql` removes every test participant, project, review and ballot.

`npm run test:database` applies all three to an in-process Postgres and rehearses the full flow with them.

## Event runbook (Organizer → Overview)

`setup` → `submissions` → `review` → *(finalize shortlist)* `shortlist_frozen` → `voting` → `closed` → *(publish)* `results_published`.
Set **Event starts / ends** first; **Plan a 5 hour day** fills a suggested schedule from the start
time (build 3h, review 45m, vote 45m) that you can edit before saving.
Every transition is a typed-confirmation dialog, checked by `admin_set_phase()` and logged. Times are
entered in the event timezone and stored in UTC; the database clock decides every deadline.

## API contract

All routes derive identity from the session cookie, never from the body. Writes require same-origin
JSON. Errors are `{error}` with these statuses: 400 malformed · 401 signed out · 403 forbidden/out of
phase · 404 · 409 conflict (e.g. ballot exists) · 422 ineligible selection.

| Route | Access |
| --- | --- |
| `GET /api/me`, `GET /api/event`, `GET /api/projects`, `GET /api/projects/:id` | any rostered role |
| `GET\|PUT /api/my-submission` | participant |
| `GET /api/voting/eligibility`, `GET /api/voting/projects`, `POST /api/voting/ballot` (201), `GET /api/voting/receipt` | participant |
| `GET /api/reviewer/assignments`, `GET /api/reviewer/assignments/:id`, `PUT …/:id/review` | reviewer (own assignments only) |
| `GET /api/admin/overview`, `GET /api/admin/submissions[?format=csv]`, `PUT /api/admin/submissions/:id/eligibility`, `POST /api/admin/assignments`, `GET /api/admin/reviews`, `POST /api/admin/shortlist/finalize`, `POST /api/admin/event/phase`, `GET /api/admin/results`, `POST /api/admin/awards`, `POST /api/admin/results/publish`, `GET /api/admin/audit-logs` | organizer |

## Screens

Shared: `/login`, `/dashboard`, `/projects`, `/projects/:id`, `/results`, `/event-rules` ·
Participant: `/submission`, `/voting`, `/voting/receipt` · Reviewer: `/reviewer/queue`, `/reviewer/projects/:id` ·
Organizer: `/admin/overview|submissions|reviews|shortlist|voting|results|people|audit`.
Routes are navigation only — every server call re-checks the role.

Motion: Lenis smooth scrolling, CSS scroll-driven reveals/parallax (no hydration side effects),
page transitions, pearl/cup micro-interactions, count-ups and live countdowns. All of it switches off
under `prefers-reduced-motion`.

## Verification status

Verified here:
- `npm run test:database` — the real schema on PGlite with a Supabase `auth` shim, exercised as the `authenticated`/`anon` roles: roster linking, unverified/outsider denial, direct-write denial, one submission, eligibility, balanced auto-assignment, reviewer isolation, pending/flagged blocking finalization, documented exceptions, every ballot rejection path (400/403/409/422), rollback of failed ballots, hidden totals, invalidation excluded from totals, unpublished awards hidden, append-only audit, choices never logged.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Browser: public pages load and every portal page/API is refused by the proxy when signed out. Earlier sample-data runs covered the ballot flow (201 → receipt, repeat 409, malformed 400, participant on admin API 403) and 375 px layouts.

Not verified (needs a real Supabase project): the proxy's signed-in role checks, magic-link email delivery, Storage cover uploads and
policies (skipped by PGlite), true concurrent requests across connections (the per-participant row
lock + unique constraint are tested sequentially), backup/restore, and the RLS advisor.

## Repository notes

- `legacy/` holds the previous open-voting version (pages, schema, tests) for reference; it is not built.
- `supabase/schema.sql` replaces the old bootstrap; it was never applied to a remote project.
