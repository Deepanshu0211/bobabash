# Boba Bash QA checklist

Tick each box as you go. Anything that doesn't match "Expect" is a bug: note the page, the account and what you saw.

## Full rehearsal (simulation)

Run these in a terminal in the project folder while the dev server is running. You play the organizer
in the browser; the script plays 12 participants and 3 volunteers.

**Once, first:** run `supabase/patches/2026-10-22-simulation-helpers.sql` and
`supabase/patches/2026-10-22-restart-after-withdraw.sql` in Supabase → SQL Editor.

| Step | You (organizer, in the browser) | Terminal |
| --- | --- | --- |
| 1 | | `npm run sim -- start` (12 projects submitted, schedule open for 4 hours) |
| 2 | Submissions: mark projects eligible, mark one ineligible with a reason | |
| 3 | Overview: move to Volunteer review. Reviews: Auto-assign | |
| 4 | | `npm run sim -- reviews` |
| 5 | Shortlist: resolve the ⚑ flagged project, then Finalize (type FINALIZE). Voting: Open voting (type VOTING) | |
| 6 | Vote as `dy3239073+test1@gmail.com`, `+test3`, `+test4` | `npm run sim -- votes` |
| 7 | Results: check totals. Voting: invalidate one ballot. Close voting, record both awards and any tie-break, Publish | |
| 8 | Check the published results as a participant | |
| 9 | | `npm run sim -- reset` (back to setup and the real 23 Oct schedule) |

`npm run sim -- status` shows where you are at any time. The simulator refuses to run once a real
roster is imported, so it can't touch real event data.

## Automated checks

- `npm test` · rules and helpers
- `npm run test:database` · 19 database suites (every phase, permission and error path)
- `npm run test:e2e` · browser QA of every page, link and safe button (run after `npm run sim -- reset`,
  since some checks expect the real 23 Oct schedule)

## Test subjects

| Who | Email | Notes |
| --- | --- | --- |
| Participant A | `dy3239073+test1@gmail.com` | Main participant for testing |
| Participant B | `dy3239073+test3@gmail.com` | Second voter |
| Participant C | `dy3239073+test4@gmail.com` | Third voter |
| Paused participant | `dy3239073+test2@gmail.com` | Currently deactivated on People |
| Organizer + reviewer | `dy3239073@gmail.com` | Needs the organizer access code |
| Reviewer only | any non-organizer team email | e.g. a volunteer's account |
| Stranger | `someone@example.com` | Not on the roster |

Use a private window per account, or sign out between accounts. **Do the phase steps (section 5) on a copy or right before cleanup, never during the real event.**

## 1. Public site (signed out, try phone and desktop)

- [ ] Home loads, the hero card is fully visible and nothing is cut off at the bottom.
- [ ] Hero shows "Fri, 23 Oct · 10:00 am to 3:00 pm" and the countdown ticks every second.
- [ ] Pearls drift up behind the hero. Scrolling is smooth.
- [ ] Header links: home, about (scrolls to About), rules, FAQ (scrolls to FAQ), enter the portal.
- [ ] Every FAQ question opens and closes. Only that answer moves.
- [ ] Event info card and footer both show the date and Chandigarh University, Lucknow.
- [ ] Footer links all work. Footer looks right on a phone (two columns).
- [ ] Rules page: three step cards, the day's six times (no "TBA"), six rule cards, "Enter the portal" works.
- [ ] No sideways scrolling on any page on a phone.
- [ ] Scrollbars match the theme (soft blue).

## 2. Sign in

- [ ] Stranger email: message says it isn't on the roster. You stay on the login page.
- [ ] Paused participant: message says the account is paused.
- [ ] Typo email like `abc`: the browser asks for a valid email.
- [ ] Participant A: lands on the dashboard straight away, no email sent.
- [ ] Organizer email with the wrong code: refused. With the right code: dashboard, tags show organizer and reviewer.
- [ ] Signed in, open `/login`: you are sent to the dashboard.
- [ ] Sign out (icon top right): back on the home page. Opening `/dashboard` again asks you to sign in.
- [ ] Signed out, open `/admin/overview` directly: sent to login. After signing in as organizer you land back on Overview.

## 3. Participant (Participant A)

- [ ] Topbar shows your name, the participant tag and the current phase.
- [ ] Sidebar shows Dashboard, Project wall, Results, Event rules, My submission, Voting booth, Ballot receipt. No organizer or reviewer items.
- [ ] Each sidebar item opens its page and gets the highlighted pearl.
- [ ] Phone: the menu button opens the drawer; Escape and the × close it; tapping a link closes it.
- [ ] Open `/admin/overview` or `/reviewer/queue` directly: bounced to the dashboard.
- [ ] Dashboard cards: My submission, Voting booth, Results. The phase timeline lights the right step.
- [ ] Project wall: search for nonsense shows the empty state; a real word filters; clicking a card opens it; "All projects" goes back.
- [ ] **During submissions:** fill the form, Save draft (toast "Draft saved"), upload a cover (preview shows before upload), Submit project. Status becomes "submitted".
- [ ] Try submitting without the demo or repo link: clear error, nothing lost.
- [ ] Try a non-GitHub repo link like `https://example.com/x`: clear error.
- [ ] Withdraw (type WITHDRAW). While submissions are open the page offers "Start a new project", with a blank form.
- [ ] Results page says the leaderboard is hidden until results are published.

## 4. Reviewer (a volunteer account)

- [ ] Sidebar has Review queue but no organizer desk.
- [ ] Queue shows assigned projects with Open demo and Repository buttons; tabs To review / Done switch.
- [ ] Opening a project shows the details and the review form.
- [ ] Pick a recommendation, rate with pearls, Submit: toast, status completed, moves to Done.
- [ ] Flag issue without a note: refused. With a note: saved.
- [ ] Edit a review: saved as a new revision.

## 5. Organizer (organizer account) — event flow

Overview:
- [ ] Four stat cards with real numbers.
- [ ] Schedule: "Plan a 5 hour day" fills every time from the start. Save schedule shows a toast and the public pages update.
- [ ] Phase button opens a dialog; it refuses until you type the exact word; the × and clicking outside close it.

People:
- [ ] Import two rows (`email, name`): count updates. A broken row is rejected and nothing is imported.
- [ ] Deactivate and Reactivate a participant: that person's sign-in follows.
- [ ] Invite a reviewer: appears in the list as invited.

Submissions:
- [ ] Filters (submitted, eligible, ineligible, draft, withdrawn, all) each show the right rows.
- [ ] Expanding a row shows description and links. Mark eligible works. Mark ineligible needs a reason.
- [ ] Export CSV downloads a file that opens in Excel or Sheets.

Reviews and shortlist:
- [ ] Auto-assign gives each eligible project three reviewers and balances the load.
- [ ] Manual assign and the × on an unreviewed assignment work.
- [ ] Shortlist tally shows ✓ ✕ ⚑ and missing dots; Finalize stays disabled until nothing is pending or flagged.
- [ ] Record an exception with a reason; it shows on the row.
- [ ] Finalize (type FINALIZE): phase becomes Shortlist frozen.

Voting and results:
- [ ] Open voting (type VOTING). Participants A, B and C each vote: pearls drop into the cup, the fourth pick is blocked, your own project can't be picked, the final dialog needs the checkbox, the receipt shows three picks.
- [ ] A second ballot from the same account is refused.
- [ ] Organizer Results shows restricted totals while voting; participants still see the hidden board.
- [ ] Invalidate a ballot (needs a 20+ character reason); totals drop by that ballot's points.
- [ ] Close voting, record both awards, record a tie-break if offered, Publish (type PUBLISH).
- [ ] Participants now see the podium, award cards and the full list.

## 6. Feel and polish

- [ ] Every button shows the hopping-pearl spinner while working, and a toast when done.
- [ ] Page changes show the boba cup loader, never a blank screen.
- [ ] Hover effects on cards and buttons feel smooth, nothing jumps.
- [ ] Fonts: Baloo 2 headings, Poppins text everywhere.
- [ ] No em dashes anywhere in the copy.

## Before the real event

- [ ] Run `supabase/seed-test-cleanup.sql` to remove test participants, projects, reviews and ballots.
- [ ] Reactivate anyone you paused while testing.
- [ ] Set the real start time on Overview and use "Plan a 5 hour day".
- [ ] Put the event back in **setup** only if you need to (it moves forward only), so plan the rehearsal on a separate Supabase project if possible.
