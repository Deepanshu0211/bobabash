'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {z} from 'zod';
import {serverClient} from '@/lib/supabase/server';
import {configured} from '@/lib/supabase/config';
import {adminClient, codeMatches, directEntryConfigured} from '@/lib/supabase/admin';
import {PortalError} from '@/lib/errors';
import {admin, apiSession, saveMyName, saveSubmission, startReview, submitReview, uploadCover, withdrawSubmission, type Session} from '@/lib/portal';
import {CRITERIA, field, idSchema, parseRoster, reviewSchema, submissionSchema} from '@/lib/validation';
import {zonedToISO} from '@/lib/rules.mjs';
import {safeNext} from '@/lib/security.mjs';
import type {ActionState, Role} from '@/lib/types';

function failure(error: unknown): ActionState {
  if (error instanceof z.ZodError) return {ok: false, message: error.issues.map(i => i.message).join(' ')};
  if (error instanceof PortalError) return {ok: false, message: error.message};
  console.error(error);
  return {ok: false, message: 'Something went wrong. Please try again.'};
}

/** Runs a mutation for a role, refreshes the portal, and reports a friendly result. */
async function act(role: Role, run: (s: Session) => Promise<string | void>, success: string): Promise<ActionState> {
  try {
    const s = await apiSession(role);
    const message = await run(s);
    revalidatePath('/', 'layout');
    return {ok: true, message: message || success};
  } catch (error) {
    return failure(error);
  }
}

function siteURL() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) throw new PortalError(500, 'Email links are not configured yet. Please contact the organizers.');
  return new URL(value).origin;
}

// ───────────── auth ─────────────
// Best-effort brake on guessing emails or codes (per server instance).
const attempts = new Map<string, {count: number; reset: number}>();
function throttle(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.reset < now) { attempts.set(key, {count: 1, reset: now + 10 * 60_000}); return; }
  if (++entry.count > 12) throw new PortalError(429, 'Too many attempts. Wait a few minutes and try again.');
}

/**
 * Direct entry (owner-approved trade-off): a rostered email signs in without an emailed link,
 * so anyone who knows that email can enter as that person. The server checks the roster with
 * the service key, then opens the session itself (generateLink + verifyOtp); no email is sent.
 * Volunteer and organizer emails also need ORGANIZER_ACCESS_CODE: the form asks for it only
 * after the email turns out to be staff (organizers without a configured code fall back to an
 * emailed link). EVENT_ACCESS_CODE, when set, is required from everyone.
 */
export async function enterPortal(_: ActionState, form: FormData): Promise<ActionState> {
  const next = safeNext(field(form, 'next'));
  try {
    if (!configured) throw new PortalError(503, 'Sign-in opens once the organizers connect the event.');
    const email = z.email('Enter a valid email address.').max(254).parse(field(form, 'email').trim().toLowerCase());
    const code = field(form, 'code').slice(0, 100);
    const ip = ((await headers()).get('x-forwarded-for') ?? 'local').split(',')[0].trim();
    throttle(ip);

    if (!directEntryConfigured) {
    
      const db = await serverClient();
      const {error} = await db.auth.signInWithOtp({email, options: {emailRedirectTo: `${siteURL()}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true}});
      if (error?.status === 429) throw new PortalError(429, 'Too many requests. Wait a minute and try again.');
      return {ok: true, message: 'Check your inbox for a sign-in link and open it in this browser.'};
    }

    const svc = adminClient();
    const [person, staff] = await Promise.all([
      svc.from('participants').select('id, active').eq('email', email).maybeSingle(),
      svc.from('staff_invites').select('role').eq('email', email)
    ]);
    if (person.error || staff.error) throw new PortalError(500, 'Could not check the roster. Please try again.');
    const organizer = (staff.data ?? []).some(r => r.role === 'organizer');
    if (!person.data && !staff.data?.length) throw new PortalError(403, 'This email isn’t on the event roster. Use the email you registered with.');
    if (person.data && !person.data.active && !staff.data?.length) throw new PortalError(403, 'This account is paused. Talk to an organizer at the help desk.');

    const staffCode = process.env.ORGANIZER_ACCESS_CODE;
    if (staff.data?.length && staffCode) {
      // Volunteers and organizers: second step asks for the team code.
      if (!code.trim()) return {ok: false, needCode: true, id: 'ask', message: 'You’re on the team. Enter the team access code to continue.'};
      if (!codeMatches(code, staffCode)) return {ok: false, needCode: true, message: 'That access code isn’t right.'};
    } else if (!codeMatches(code, process.env.EVENT_ACCESS_CODE)) throw new PortalError(403, 'That access code isn’t right.');
    if (organizer && !staffCode) {
      const db = await serverClient();
      await db.auth.signInWithOtp({email, options: {emailRedirectTo: `${siteURL()}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true}});
      return {ok: true, message: 'Organizer accounts confirm by email. Check your inbox for the sign-in link.'};
    }

    // Make sure the auth account exists and is confirmed (the auth trigger links roster roles).
    const created = await svc.auth.admin.createUser({email, email_confirm: true});
    if (created.error && created.error.status !== 422) throw new PortalError(500, 'Could not open your account. Please try again.');
    const link = await svc.auth.admin.generateLink({type: 'magiclink', email});
    const tokenHash = link.data?.properties?.hashed_token;
    if (link.error || !tokenHash) throw new PortalError(500, 'Could not open your session. Please try again.');
    const db = await serverClient();
    const {error} = await db.auth.verifyOtp({type: 'email', token_hash: tokenHash});
    if (error) throw new PortalError(500, 'Could not open your session. Please try again.');
  } catch (error) { return failure(error); }
  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signOut() {
  if (configured) await (await serverClient()).auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

// ───────────── everyone ─────────────
export async function saveNameAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const name = z.string().trim().min(2, 'Use at least 2 characters.').max(60, 'Use 60 characters or fewer.').parse(field(form, 'name').replace(/\s+/g, ' '));
    await saveMyName(await apiSession(), name);
    revalidatePath('/', 'layout');
    return {ok: true, message: `Nice to meet you, ${name}!`};
  } catch (error) { return failure(error); }
}

// ───────────── participant ─────────────
export async function saveSubmissionAction(_: ActionState, form: FormData): Promise<ActionState> {
  const submit = field(form, 'intent') === 'submit';
  return act('participant', async s => {
    await saveSubmission(s, submissionSchema.parse(Object.fromEntries(form)), submit);
  }, submit ? 'Submitted! Organizers will check eligibility after the deadline.' : 'Draft saved.');
}
export async function uploadCoverAction(_: ActionState, form: FormData): Promise<ActionState> {
  return act('participant', async s => {
    const file = form.get('image');
    if (!(file instanceof File) || !file.size) throw new PortalError(400, 'Choose an image first.');
    await uploadCover(s, file);
  }, 'Cover uploaded.');
}
export async function withdrawAction(_: ActionState, form: FormData): Promise<ActionState> {
  return act('participant', s => withdrawSubmission(s, field(form, 'reason').slice(0, 500)), 'Project withdrawn. While submissions are open you can start a new one here.');
}

// ───────────── reviewer ─────────────
export async function startReviewAction(id: string) {
  try { const s = await apiSession('reviewer'); await startReview(s, idSchema.parse(id)); } catch { /* best effort status update */ }
}
export async function reviewAction(_: ActionState, form: FormData): Promise<ActionState> {
  return act('reviewer', async s => {
    const criteria = Object.fromEntries(CRITERIA.flatMap(k => form.get('c_' + k) ? [[k, Number(form.get('c_' + k))]] : []));
    const body = reviewSchema.parse({recommendation: field(form, 'recommendation'), criteria, note: field(form, 'note')});
    await submitReview(s, idSchema.parse(field(form, 'assignment_id')), body.recommendation, body.criteria, body.note);
  }, 'Review saved. Thank you!');
}

// ───────────── organizer ─────────────
const reason = (form: FormData) => field(form, 'reason').trim().slice(0, 1000);
const ops: Record<string, (s: Session, form: FormData) => Promise<string | void>> = {
  async event(s, form) {
    const timezone = z.string().trim().min(1).max(80).parse(field(form, 'timezone'));
    try { new Intl.DateTimeFormat('en', {timeZone: timezone}); } catch { throw new PortalError(400, 'Use an IANA timezone like Asia/Kolkata.'); }
    const at = (k: string) => zonedToISO(field(form, k), timezone);
    await admin.updateEvent(s, {
      name: z.string().trim().min(1).max(120).parse(field(form, 'name')), timezone,
      starts_at: at('starts_at'), ends_at: at('ends_at'),
      submission_deadline: at('submission_deadline'), review_deadline: at('review_deadline'),
      voting_open_at: at('voting_open_at'), voting_close_at: at('voting_close_at'),
      show_creator_names: form.get('show_creator_names') === 'on',
      venue_name: field(form, 'venue_name').slice(0, 200), venue_address: field(form, 'venue_address').slice(0, 500), announcement: field(form, 'announcement').slice(0, 2000)
    });
    return 'Schedule saved.';
  },
  async phase(s, form) { await admin.setPhase(s, z.enum(['submissions', 'review', 'voting', 'closed']).parse(field(form, 'target'))); return 'Phase updated.'; },
  async roster(s, form) {
    const track = z.enum(['competing', 'showcase']).parse(field(form, 'track') || 'competing');
    const n = await admin.importRoster(s, parseRoster(field(form, 'roster')).map(r => ({...r, track})));
    return `${n ?? 0} roster rows imported as ${track === 'showcase' ? 'showcase' : 'competition'}.`;
  },
  async track(s, form) { await admin.setTrack(s, idSchema.parse(field(form, 'id')), z.enum(['competing', 'showcase']).parse(field(form, 'track'))); return 'Track updated.'; },
  async votes(s, form) {
    await admin.setVotes(s, idSchema.parse(field(form, 'id')), z.coerce.number().int('Use a whole number.').min(0).max(100000).parse(field(form, 'votes')), field(form, 'reason').slice(0, 1000));
    return 'Vote total updated and logged.';
  },
  async active(s, form) { await admin.setActive(s, idSchema.parse(field(form, 'id')), field(form, 'active') === 'true'); },
  async remove(s, form) { await admin.removeParticipant(s, idSchema.parse(field(form, 'id'))); return 'Participant removed.'; },
  async invite(s, form) {
    await admin.inviteStaff(s, z.email().parse(field(form, 'email').trim()), z.enum(['reviewer', 'organizer']).parse(field(form, 'role')), field(form, 'display_name').slice(0, 80));
    return 'Invitation saved. They can sign in with that email.';
  },
  async revoke(s, form) { await admin.revokeStaff(s, z.email().parse(field(form, 'email')), z.enum(['reviewer', 'organizer']).parse(field(form, 'role'))); return 'Role removed.'; },
  async eligibility(s, form) { await admin.setEligibility(s, idSchema.parse(field(form, 'id')), field(form, 'eligible') === 'true', reason(form)); return 'Eligibility recorded.'; },
  async assign(s, form) { await admin.assign(s, idSchema.parse(field(form, 'submission_id')), idSchema.parse(field(form, 'reviewer_id'))); return 'Reviewer assigned.'; },
  async unassign(s, form) { await admin.unassign(s, idSchema.parse(field(form, 'id'))); return 'Assignment removed.'; },
  async auto(s, form) { const n = await admin.autoAssign(s, z.coerce.number().int().min(1).max(10).parse(field(form, 'per_project') || '3')); return `${n ?? 0} assignments created.`; },
  async resolve(s, form) { await admin.resolve(s, idSchema.parse(field(form, 'id')), z.enum(['shortlisted', 'not_shortlisted', 'pending']).parse(field(form, 'outcome')), reason(form)); return 'Organizer decision recorded.'; },
  async finalize(s) { const r = await admin.finalize(s); return r ? `Shortlist frozen: ${r.shortlisted} shortlisted, ${r.not_shortlisted} not shortlisted.` : undefined; },
  async emergency(s, form) { await admin.emergencyRemove(s, idSchema.parse(field(form, 'id')), reason(form)); return 'Emergency correction logged.'; },
  async invalidate(s, form) { await admin.invalidateBallot(s, idSchema.parse(field(form, 'id')), reason(form)); return 'Ballot invalidated and logged.'; },
  async award(s, form) {
    await admin.recordAward(s, z.enum(['creative', 'best_github']).parse(field(form, 'award_type')), idSchema.parse(field(form, 'submission_id')), field(form, 'judged_by'), field(form, 'rationale'));
    return 'Award recorded.';
  },
  async tiebreak(s, form) {
    const tied = form.getAll('tied').map(v => idSchema.parse(String(v)));
    const shared = field(form, 'winner') === 'shared';
    await admin.recordTieBreak(s, z.coerce.number().int().min(1).max(100).parse(field(form, 'position')), tied, shared ? null : idSchema.parse(field(form, 'winner')), shared, field(form, 'rationale'));
    return 'Tie-break decision recorded.';
  },
  async publish(s) { await admin.publish(s); return 'Results published!'; }
};

export async function adminAction(_: ActionState, form: FormData): Promise<ActionState> {
  const op = ops[field(form, 'op')];
  if (!op) return {ok: false, message: 'Unknown action.'};
  return act('organizer', s => op(s, form), 'Saved and logged.');
}

