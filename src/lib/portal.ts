import 'server-only';
import {cache} from 'react';
import {redirect} from 'next/navigation';
import type {SupabaseClient} from '@supabase/supabase-js';
import {serverClient} from './supabase/server';
import {configured} from './supabase/config';
import {errorStatus} from './rules.mjs';
import {checkImage} from './security.mjs';
import {PortalError} from './errors';
import type {
  Assignment, AuditRow, Award, BallotRow, Decision, EventSettings, Overview, Participant, Receipt,
  AwardType, ResultRow, Role, Staff, Submission, TallyRow, Track, VoteCount, VotingStatus, WallProject, WallView
} from './types';

export {PortalError};

export type Session = {
  db: SupabaseClient; userId: string; email: string; roles: Role[];
  participant: Participant | null;
  /** The name the person chose (null until they save one). */
  name: string | null;
  /** What to show: chosen name, else roster name, else the part of the email before @. */
  displayName: string;
};

type Result<T> = {data: T; error: {code?: string; message: string} | null};
function check<T>({data, error}: Result<T>): T {
  if (error) {
    const status = errorStatus(error.code);
    // Only our own BBxxx messages are written for people; never echo internal database errors.
    throw new PortalError(status, error.code?.startsWith('BB') ? error.message
      : status === 403 ? 'You do not have access to this.' : status === 404 ? 'Not found.' : 'Something went wrong. Please try again.');
  }
  return data;
}

export const getSession = cache(async (): Promise<Session | null> => {
  if (!configured) return null;
  const db = await serverClient();
  const {data: {user}} = await db.auth.getUser();
  if (!user) return null;
  const [roles, participant] = await Promise.all([
    db.from('user_roles').select('role').eq('user_id', user.id),
    db.from('participants').select('id,email,display_name,user_id,active,created_at').eq('user_id', user.id).maybeSingle()
  ]);
  const p = check(participant) as Participant | null;
  const saved = typeof user.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim() ? user.user_metadata.display_name.trim() : null;
  const email = user.email ?? '';
  return {db, userId: user.id, email, roles: (check(roles) ?? []).map(r => r.role as Role), participant: p, name: saved, displayName: saved ?? p?.display_name ?? email.split('@')[0]};
});

export async function requireSession(next = '/dashboard') {
  const s = await getSession();
  if (!s) redirect('/login?next=' + encodeURIComponent(next));
  return s;
}
export async function requireRole(role: Role, next?: string) {
  const s = await requireSession(next);
  if (!s.roles.includes(role)) redirect('/dashboard');
  return s;
}
/** For API routes: throws instead of redirecting. */
export async function apiSession(role?: Role) {
  const s = await getSession();
  if (!s) throw new PortalError(401, 'Please sign in.');
  if (role ? !s.roles.includes(role) : !s.roles.length) throw new PortalError(403, 'You do not have access to this.');
  return s;
}

export const getEvent = cache(async (): Promise<EventSettings | null> => {
  if (!configured) return null;
  const db = await serverClient();
  return check(await db.from('event_settings').select('*').eq('id', 1).maybeSingle());
});

async function signCovers<T extends {cover_image_path: string | null; cover?: string | null}>(s: Session, rows: T[]): Promise<T[]> {
  const paths = [...new Set(rows.flatMap(r => r.cover_image_path ? [r.cover_image_path] : []))];
  if (!paths.length) return rows;
  const {data} = await s.db.storage.from('project-covers').createSignedUrls(paths, 600);
  return rows.map(r => ({...r, cover: data?.find(u => u.path === r.cover_image_path)?.signedUrl ?? null}));
}

async function rpc<T>(s: Session, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return check(await s.db.rpc(fn, args)) as T;
}

// ───────────── shared reads ─────────────
export async function listProjects(s: Session, {search = '', shortlistedOnly = false, page = 1, size = 24, view = 'all' as WallView} = {}) {
  const args = {search: search.slice(0, 100), shortlisted_only: shortlistedOnly || view === 'shortlisted', page_size: size, page_offset: (page - 1) * size};
  let result = await s.db.rpc('project_wall', view === 'all' ? args : {...args, wall_view: view});
  // Database without the open-wall patch: it has no wall_view filter, so fall back to the plain list.
  if (result.error?.code === 'PGRST202') result = await s.db.rpc('project_wall', args);
  const rows = hideTrack(check(result) as (WallProject & {total_count: number})[]);
  return {projects: await signCovers(s, rows), total: Number(rows[0]?.total_count ?? 0)};
}
// The live database labels showcase projects 'showcase' on the wall; participants must never see
// that, so they show as a normal project awaiting its check.
const hideTrack = <T extends {status: string}>(rows: T[]) => rows.map(r => (r.status === 'showcase' ? {...r, status: 'submitted'} : r));

export async function getProject(s: Session, id: string) {
  const rows = hideTrack(await rpc<WallProject[]>(s, 'project_wall', {only_id: id}));
  if (!rows[0]) return null;
  return (await signCovers(s, rows))[0];
}

// ───────────── participant ─────────────
export async function getMySubmission(s: Session): Promise<Submission | null> {
  if (!s.participant) return null;
  const row = check(await s.db.from('submissions').select('*').eq('participant_id', s.participant.id).maybeSingle());
  return row ? (await signCovers(s, [row as Submission]))[0] : null;
}
export const saveSubmission = (s: Session, payload: Record<string, string>, submit: boolean) =>
  rpc<string>(s, 'save_my_submission', {payload, submit});
export const withdrawSubmission = (s: Session, reason: string) => rpc<void>(s, 'withdraw_my_submission', {reason});

export async function uploadCover(s: Session, file: File) {
  if (file.size > 5 * 1024 * 1024) throw new PortalError(400, 'Images must be 5 MB or smaller.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let kind;
  try { kind = checkImage(bytes); } catch (e) { throw new PortalError(400, (e as Error).message); }
  const path = `${s.userId}/${crypto.randomUUID()}.${kind.ext}`;
  const {error} = await s.db.storage.from('project-covers').upload(path, bytes, {contentType: kind.mime, upsert: false});
  if (error) {
    console.error('cover upload failed:', error.message);
    throw new PortalError(403, 'The image could not be uploaded. Submissions may be closed, or your session expired: refresh and try again.');
  }
  try {
    const previous = await rpc<string | null>(s, 'attach_my_cover', {object_path: path});
    if (previous) await s.db.storage.from('project-covers').remove([previous]);
  } catch (e) {
    await s.db.storage.from('project-covers').remove([path]);
    throw e;
  }
}

/** Saves the person's display name (roster, staff list and profile). */
export async function saveMyName(s: Session, name: string) {
  const {error} = await s.db.rpc('set_my_name', {new_name: name});
  if (error?.code === 'PGRST202') {
    // Database without the display-names patch: keep it on the sign-in profile for now.
    const {error: e} = await s.db.auth.updateUser({data: {display_name: name}});
    if (e) throw new PortalError(500, 'Could not save your name. Please try again.');
    return;
  }
  check({data: null, error});
}

export const getVotingStatus = (s: Session) => rpc<VotingStatus>(s, 'my_voting_status');
export const getReceipt = (s: Session) => rpc<Receipt | null>(s, 'my_ballot_receipt');
export const submitBallot = (s: Session, ids: string[]) => rpc<string>(s, 'submit_ballot', {selections: ids});

/** Returns null when the caller may not see totals yet, so the leaderboard stays hidden. */
export async function getResults(s: Session): Promise<ResultRow[] | null> {
  try { return (await rpc<ResultRow[]>(s, 'vote_results')).map(r => ({...r, votes: Number(r.votes), standing: Number(r.standing)})); }
  catch (e) { if (e instanceof PortalError && e.status === 403) return null; throw e; }
}
export async function getAwards(s: Session): Promise<Award[]> {
  return check(await s.db.from('awards').select('award_type,submission_id,judged_by,rationale,published_at,submissions(title)')) as unknown as Award[];
}
export async function getDecisions(s: Session): Promise<Decision[]> {
  return check(await s.db.from('result_decisions').select('*').order('position')) as Decision[];
}

// ───────────── reviewer ─────────────
const assignmentFields = 'id,submission_id,reviewer_id,status,assigned_at,submissions(*),reviews(*)';
export async function listMyAssignments(s: Session): Promise<Assignment[]> {
  const rows = check(await s.db.from('reviewer_assignments').select(assignmentFields).eq('reviewer_id', s.userId).order('assigned_at')) as unknown as Assignment[];
  const covers = await signCovers(s, rows.flatMap(r => r.submissions ? [r.submissions] : []));
  return rows.map(r => ({...r, submissions: covers.find(c => c.id === r.submission_id) ?? r.submissions}));
}
export async function getMyAssignment(s: Session, id: string): Promise<Assignment | null> {
  const row = check(await s.db.from('reviewer_assignments').select(assignmentFields).eq('id', id).eq('reviewer_id', s.userId).maybeSingle()) as unknown as Assignment | null;
  if (row?.submissions) row.submissions = (await signCovers(s, [row.submissions]))[0];
  return row;
}
export const startReview = (s: Session, id: string) => rpc<void>(s, 'start_review', {assignment_id: id});
export const submitReview = (s: Session, id: string, recommendation: string, criteria: Record<string, number>, note: string) =>
  rpc<void>(s, 'submit_review', {assignment_id: id, recommendation, criteria, note});

// ───────────── organizer ─────────────
export const getOverview = (s: Session) => rpc<Overview>(s, 'admin_overview');
// Tracks for organizer pages only; participant pages never load them.
async function trackMap(s: Session) {
  const {data, error} = await s.db.from('participants').select('id,track');
  return new Map<string, Track>(error ? [] : (data as {id: string; track: Track}[]).map(r => [r.id, r.track]));
}
export async function listSubmissions(s: Session, {status = '', search = ''} = {}): Promise<Submission[]> {
  let q = s.db.from('submissions').select('*,participants(display_name,email)').order('submitted_at', {ascending: true, nullsFirst: false});
  if (status) q = q.eq('status', status);
  if (search) q = q.ilike('title', '%' + search.replace(/[%_\\]/g, '').slice(0, 100) + '%');
  const [rows, tracks] = await Promise.all([q.limit(500), trackMap(s)]);
  return (check(rows) as unknown as Submission[]).map(r => r.participants ? {...r, participants: {...r.participants, track: tracks.get(r.participant_id) ?? 'competing'}} : r);
}
export async function listAllAssignments(s: Session): Promise<Assignment[]> {
  return check(await s.db.from('reviewer_assignments').select('id,submission_id,reviewer_id,status,assigned_at,reviews(recommendation,note,revision,submitted_at)').limit(2000)) as unknown as Assignment[];
}
export async function listStaff(s: Session): Promise<Staff[]> {
  return (await rpc<Staff[]>(s, 'admin_staff')).map(r => ({...r, assigned: Number(r.assigned), completed: Number(r.completed)}));
}
export async function listRoster(s: Session): Promise<(Participant & {project: string | null})[]> {
  const [res, tracks] = await Promise.all([s.db.from('participants').select('id,email,display_name,user_id,active,created_at, submissions(title)').order('display_name').limit(1000), trackMap(s)]);
  const rows = check(res) as (Participant & {submissions: {title: string} | {title: string}[] | null})[];
  return rows.map(({submissions: sub, ...p}) => ({...p, track: tracks.get(p.id) ?? 'competing', project: (Array.isArray(sub) ? sub[0] : sub)?.title ?? null}));
}
export const getTally = (s: Session) => rpc<TallyRow[]>(s, 'shortlist_tally');
export const listVoteCounts = (s: Session) => rpc<VoteCount[]>(s, 'admin_vote_counts');
export async function listBallots(s: Session): Promise<BallotRow[]> {
  const [res, tracks] = await Promise.all([s.db.from('ballots').select('id,status,submitted_at,invalidated_reason,participant_id,participants(display_name,email),ballot_selections(submission_id,submissions(title))').order('submitted_at', {ascending: false}).limit(1000), trackMap(s)]);
  return (check(res) as unknown as (BallotRow & {participant_id: string})[]).map(b => b.participants ? {...b, participants: {...b.participants, track: tracks.get(b.participant_id) ?? 'competing'}} : b);
}
export async function listAudit(s: Session, page = 1): Promise<{rows: AuditRow[]; total: number}> {
  const {data, error, count} = await s.db.from('audit_logs').select('*', {count: 'exact'}).order('created_at', {ascending: false}).range((page - 1) * 50, page * 50 - 1);
  return {rows: check({data, error}) as AuditRow[], total: count ?? 0};
}

export const admin = {
  updateEvent: (s: Session, payload: Record<string, unknown>) => rpc<void>(s, 'admin_update_event', {payload}),
  setPhase: (s: Session, target: string) => rpc<void>(s, 'admin_set_phase', {target}),
  importRoster: (s: Session, roster: {email: string; display_name: string; track?: Track}[]) => rpc<number>(s, 'admin_import_roster', {roster}),
  setTrack: (s: Session, id: string, track: Track) => rpc<void>(s, 'admin_set_participant_track', {participant_id: id, track}),
  setVotes: (s: Session, id: string, votes: number, reason: string) => rpc<void>(s, 'admin_set_votes', {submission_id: id, votes, reason}),
  setActive: (s: Session, id: string, active: boolean) => rpc<void>(s, 'admin_set_participant_active', {participant_id: id, active}),
  removeParticipant: async (s: Session, id: string) => {
    const result = await s.db.rpc('admin_remove_participant', {participant_id: id});
    if (result.error?.code === 'PGRST202') throw new PortalError(503, 'Removing needs supabase/patches/2026-10-22-remove-participant.sql. Run it in the Supabase SQL Editor first.');
    check(result);
  },
  inviteStaff: (s: Session, email: string, role: string, name: string) => rpc<void>(s, 'admin_invite_staff', {email, role, display_name: name}),
  revokeStaff: (s: Session, email: string, role: string) => rpc<void>(s, 'admin_revoke_staff', {email, role}),
  setEligibility: (s: Session, id: string, eligible: boolean, reason: string) => rpc<void>(s, 'admin_set_eligibility', {submission_id: id, eligible, reason}),
  assign: (s: Session, submission: string, reviewer: string) => rpc<string>(s, 'admin_assign_reviewer', {submission_id: submission, reviewer_id: reviewer}),
  unassign: (s: Session, id: string) => rpc<void>(s, 'admin_unassign', {assignment_id: id}),
  autoAssign: (s: Session, perProject: number) => rpc<number>(s, 'admin_auto_assign', {per_project: perProject}),
  resolve: (s: Session, id: string, outcome: string, reason: string) => rpc<void>(s, 'admin_resolve_submission', {submission_id: id, outcome, reason}),
  finalize: (s: Session) => rpc<{shortlisted: number; not_shortlisted: number}>(s, 'admin_finalize_shortlist'),
  emergencyRemove: (s: Session, id: string, reason: string) => rpc<void>(s, 'admin_emergency_remove', {submission_id: id, reason}),
  invalidateBallot: (s: Session, id: string, reason: string) => rpc<void>(s, 'admin_invalidate_ballot', {ballot_id: id, reason}),
  recordAward: (s: Session, type: string, submission: string, judgedBy: string, rationale: string) =>
    rpc<void>(s, 'admin_record_award', {award_type: type, submission_id: submission, judged_by: judgedBy, rationale}),
  recordTieBreak: (s: Session, position: number, tied: string[], winner: string | null, shared: boolean, rationale: string) =>
    rpc<void>(s, 'admin_record_tie_break', {rank_position: position, tied, winner, shared, rationale}),
  publish: (s: Session) => rpc<void>(s, 'admin_publish_results')
};

export function formatDate(value: string | null | undefined, timezone = 'Asia/Kolkata') {
  return value ? new Intl.DateTimeFormat('en-IN', {dateStyle: 'medium', timeStyle: 'short', timeZone: timezone}).format(new Date(value)) : 'To be announced';
}

export function formatTime(value: string | null | undefined, timezone = 'Asia/Kolkata') {
  return value ? new Intl.DateTimeFormat('en-IN', {timeStyle: 'short', timeZone: timezone}).format(new Date(value)) : 'TBA';
}

/** "Fri, 23 Oct". Only the date is public: timings are announced on the day. */
export function formatEventDay(event: EventSettings | null) {
  if (!event?.starts_at) return null;
  return new Intl.DateTimeFormat('en-IN', {weekday: 'short', day: 'numeric', month: 'short', timeZone: event.timezone}).format(new Date(event.starts_at));
}

export type Highlight = {kind: 'place' | AwardType; place: number | null; submission_id: string; title: string; creator_name: string | null; votes: number | null};
/** Public winners for the landing page. Empty until results are published (or before the patch runs). */
export async function getHighlights(): Promise<Highlight[]> {
  if (!configured) return [];
  const db = await serverClient();
  const {data, error} = await db.rpc('public_highlights');
  if (error) return [];
  return (data as Highlight[]).map(h => ({...h, votes: h.votes === null ? null : Number(h.votes)}));
}
