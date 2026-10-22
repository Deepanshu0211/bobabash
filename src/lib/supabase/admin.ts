import 'server-only';
import {createHash, timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

// Server-only privileged client, used for exactly one job: letting a rostered email
// sign in without an emailed link. It never reaches the browser (no NEXT_PUBLIC_ prefix,
// `server-only` import), and every other operation still goes through the user's session + RLS.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const directEntryConfigured = Boolean(url && secret);

export function adminClient() {
  if (!url || !secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  return createClient(url, secret, {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}});
}

/** Constant-time comparison of a typed code against a configured one. Empty config means "no code needed". */
export function codeMatches(typed: string, expected: string | undefined) {
  if (!expected) return true;
  const a = createHash('sha256').update(typed.trim()).digest();
  const b = createHash('sha256').update(expected.trim()).digest();
  return timingSafeEqual(a, b);
}
