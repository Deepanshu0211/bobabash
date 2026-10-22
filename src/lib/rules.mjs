// Pure event rules shared by the UI, API and tests. PostgreSQL is the authority:
// these mirrors only drive previews and friendly messages, never decisions.

/** @type {{id:string,label:string,short:string,description:string}[]} */
export const PHASES = [
  {id: 'setup', label: 'Getting ready', short: 'setup', description: 'Organizers import the roster and set the schedule.'},
  {id: 'submissions', label: 'Submissions open', short: 'build', description: 'Build your project and submit one entry before the deadline.'},
  {id: 'review', label: 'Volunteer review', short: 'review', description: 'Three volunteers independently review every eligible project.'},
  {id: 'shortlist_frozen', label: 'Shortlist frozen', short: 'shortlist', description: 'The majority shortlist is final. Voting opens soon.'},
  {id: 'voting', label: 'Voting open', short: 'vote', description: 'Pick three projects you love. One final ballot each.'},
  {id: 'closed', label: 'Voting closed', short: 'count', description: 'Organizers verify totals, ties and judged awards.'},
  {id: 'results_published', label: 'Results are in', short: 'results', description: 'Final results and special awards are public.'}
];

export function phaseIndex(phase) {
  return Math.max(0, PHASES.findIndex(p => p.id === phase));
}

/** Organizer phase moves that are a single click (finalize and publish have their own flows). */
export const PHASE_MOVES = {setup: 'submissions', submissions: 'review', shortlist_frozen: 'voting', voting: 'closed'};

/**
 * Volunteer-majority outcome for one project. Missing reviews are pending, never rejections.
 * @param {{assigned:number,completed:number,shortlist:number,flag:number}} c
 * @returns {'pending'|'flagged'|'pass'|'fail'}
 */
export function shortlistOutcome({assigned, completed, shortlist, flag}) {
  if (completed < 3 || completed < assigned) return 'pending';
  if (flag > 0) return 'flagged';
  return shortlist * 2 > completed ? 'pass' : 'fail';
}

/**
 * @param {string[]} ids
 * @param {{max?: number, ownId?: string|null, allowed?: string[]|null}} [options]
 * @returns {string|null} a reason the selection cannot be submitted, or null when it is valid.
 */
export function ballotProblem(ids, {max = 3, ownId = null, allowed = null} = {}) {
  if (!Array.isArray(ids) || ids.length !== max) return `Choose exactly ${max} projects.`;
  if (new Set(ids).size !== ids.length) return 'Each project can be chosen only once.';
  if (ownId && ids.includes(ownId)) return 'You cannot vote for your own project.';
  if (allowed && ids.some(id => !allowed.includes(id))) return 'Only shortlisted projects can be chosen.';
  return null;
}

/** Manual control: voting is open exactly while organizers have the event in the voting phase. */
export function votingOpen(event) {
  return Boolean(event && event.phase === 'voting');
}

/** Maps database error codes to HTTP statuses for the API contract. */
export const ERROR_STATUS = {BB400: 400, BB401: 401, BB403: 403, BB404: 404, BB409: 409, BB422: 422, '42501': 403, PGRST116: 404};

export function errorStatus(code) {
  return ERROR_STATUS[code] ?? 500;
}

/** Up to two initials from a name: "Test Participant" → "TP", "deepanshu" → "D". */
export function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?')[0]).toUpperCase();
}

/** Stable pseudo-random pick so a project without a cover always gets the same mascot art. */
export function artFor(id, choices) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return choices[hash % choices.length];
}

function zoneOffset(ts, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'})
    .formatToParts(ts).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts;
}

/** "2026-11-01T13:00" interpreted in `timeZone` → ISO UTC string. Empty input stays empty. */
export function zonedToISO(local, timeZone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local ?? '');
  if (!m) return '';
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = guess - zoneOffset(guess, timeZone);
  const corrected = guess - zoneOffset(utc, timeZone);
  if (corrected !== utc) utc = corrected;
  return new Date(utc).toISOString();
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" wall-clock value in `timeZone`, for datetime-local inputs. */
export function isoToZoned(iso, timeZone) {
  if (!iso) return '';
  const ts = Date.parse(iso);
  return new Date(ts + zoneOffset(ts, timeZone)).toISOString().slice(0, 16);
}

/** True when `iso` is set and still ahead of the clock. */
export function isFuture(iso, now = Date.now()) {
  return Boolean(iso) && Date.parse(iso) > now;
}

/** Whole or half hours between two timestamps, e.g. 5 or 4.5. Null when either is missing. */
export function durationHours(start, end) {
  if (!start || !end) return null;
  return Math.round(((Date.parse(end) - Date.parse(start)) / 36e5) * 2) / 2;
}

/**
 * Suggested run of show for a short, single-day event, as minute offsets from the start.
 * Organizers can edit every field afterwards.
 */
export const SHORT_EVENT_PLAN = [
  ['submission_deadline', 180], ['review_deadline', 225], ['voting_open_at', 235], ['voting_close_at', 280], ['ends_at', 300]
];
