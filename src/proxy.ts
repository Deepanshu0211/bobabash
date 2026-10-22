// Next.js 16 middleware ("proxy"): the first gate in front of the portal.
// Only verified accounts that hold a role on the event roster get through, and each
// area needs its role. The database (RLS + functions) still enforces everything again.
import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';
import {configured, credentials} from './lib/supabase/config';

type Role = 'participant' | 'reviewer' | 'organizer';

/** Longest matching prefix wins. `null` means any rostered role. */
const AREAS: [string, Role | null][] = [
  ['/admin', 'organizer'], ['/api/admin', 'organizer'],
  ['/reviewer', 'reviewer'], ['/api/reviewer', 'reviewer'],
  ['/submission', 'participant'], ['/voting', 'participant'],
  ['/api/voting', 'participant'], ['/api/my-submission', 'participant'],
  ['/dashboard', null], ['/projects', null], ['/results', null], ['/api', null]
];

function areaFor(path: string) {
  return AREAS.filter(([prefix]) => path === prefix || path.startsWith(prefix + '/')).sort((a, b) => b[0].length - a[0].length)[0];
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({request});
  const path = request.nextUrl.pathname;
  const area = areaFor(path);
  const isApi = path.startsWith('/api/');

  // Carry refreshed auth cookies onto redirects and error responses too.
  const finish = (next: NextResponse) => {
    response.cookies.getAll().forEach(c => next.cookies.set(c));
    next.headers.set('Cache-Control', 'private, no-store');
    return next;
  };
  const deny = (status: 401 | 403 | 503, message: string, to: string) => finish(isApi
    ? NextResponse.json({error: message}, {status})
    : NextResponse.redirect(new URL(to, request.url)));

  if (!configured) return area ? deny(503, 'The portal is not connected yet.', '/login') : response;

  const {url, key} = credentials();
  const db = createServerClient(url, key, {cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      values.forEach(({name, value}) => request.cookies.set(name, value));
      response = NextResponse.next({request});
      values.forEach(({name, value, options}) => response.cookies.set(name, value, options));
    }
  }});
  const {data: {user}} = await db.auth.getUser();
  if (!area) { response.headers.set('Cache-Control', 'private, no-store'); return response; }

  const login = '/login?next=' + encodeURIComponent(path + request.nextUrl.search);
  if (!user || !user.email_confirmed_at) return deny(401, 'Please sign in.', login);

  const {data, error} = await db.from('user_roles').select('role').eq('user_id', user.id);
  const roles = (data ?? []).map(r => r.role as Role);
  if (error || !roles.length) return deny(403, 'Your account is not on the event roster.', '/login?denied=1');

  const needed = area[1];
  if (needed && !roles.includes(needed)) return deny(403, 'You do not have access to this area.', '/dashboard');

  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/).*)']};
