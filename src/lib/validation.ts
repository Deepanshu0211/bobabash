import {z} from 'zod';

const https = z.union([z.literal(''), z.url().max(2048).refine(v => new URL(v).protocol === 'https:', 'Use an HTTPS URL.')]);
const repository = z.union([z.literal(''), z.url().max(2048).refine(v => /^https:\/\/(github\.com|gitlab\.com|codeberg\.org|bitbucket\.org)\/\S+$/.test(v), 'Use a GitHub, GitLab, Codeberg or Bitbucket HTTPS link.')]);

export const CATEGORIES = ['website', 'game', 'tool', 'art', 'hardware', 'other'] as const;
export const CRITERIA = ['functionality', 'originality', 'presentation', 'effort'] as const;

export const idSchema = z.uuid();
export const submissionSchema = z.object({
  title: z.string().trim().min(3, 'Title needs at least 3 characters.').max(100),
  description: z.string().trim().min(20, 'Tell us a little more (20+ characters).').max(4000),
  demo_url: https,
  repository_url: repository,
  category: z.enum(CATEGORIES)
});
export const ballotSchema = z.object({submission_ids: z.array(z.string()).max(10)}).strict();
export const reviewSchema = z.object({
  recommendation: z.enum(['shortlist', 'reject', 'flag']),
  criteria: z.partialRecord(z.enum(CRITERIA), z.number().int().min(1).max(5)),
  note: z.string().max(2000).default('')
});
const timestamp = z.union([z.literal(''), z.iso.datetime({offset: true})]);
export const eventSchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(80).refine(tz => { try { new Intl.DateTimeFormat('en', {timeZone: tz}); return true; } catch { return false; } }, 'Use an IANA timezone like Asia/Kolkata.'),
  submission_deadline: timestamp, review_deadline: timestamp, voting_open_at: timestamp, voting_close_at: timestamp,
  show_creator_names: z.boolean()
});
export const phaseSchema = z.object({phase: z.enum(['submissions', 'review', 'voting', 'closed'])});
export const eligibilitySchema = z.object({eligible: z.boolean(), reason: z.string().max(1000).default('')});
export const assignmentSchema = z.union([
  z.object({submission_id: z.uuid(), reviewer_id: z.uuid()}),
  z.object({auto: z.literal(true), per_project: z.number().int().min(1).max(10).default(3)})
]);
export const awardSchema = z.object({award_type: z.enum(['creative', 'best_github']), submission_id: z.uuid(), judged_by: z.string().trim().min(2).max(200), rationale: z.string().trim().min(10).max(2000)});

export function field(form: FormData, key: string) { return String(form.get(key) ?? ''); }

/** Parses "email, name" lines (or a CSV with those two columns) into roster rows. */
export function parseRoster(text: string) {
  const rows = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    .map(line => line.split(/[,\t;]/).map(c => c.trim().replace(/^"|"$/g, '')))
    .filter(([email]) => email && !/^e-?mail$/i.test(email));
  return z.array(z.object({email: z.email().transform(e => e.toLowerCase()), display_name: z.string().min(1).max(80)})).max(500)
    .parse(rows.map(([email, ...name]) => ({email, display_name: name.join(' ').trim() || email.split('@')[0]})));
}
