import {NextResponse, type NextRequest} from 'next/server';
import type {EmailOtpType} from '@supabase/supabase-js';
import {serverClient} from '@/lib/supabase/server';
import {safeNext} from '@/lib/security.mjs';

// Handles both link styles Supabase can send:
//  - ?code=…            (default PKCE link; must be opened in the browser that requested it)
//  - ?token_hash=…&type= (custom email template; works in any browser)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get('next'));
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;

  if (code || (tokenHash && type)) {
    const db = await serverClient();
    const {error} = code
      ? await db.auth.exchangeCodeForSession(code)
      : await db.auth.verifyOtp({token_hash: tokenHash!, type: type!});
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  const reason = params.get('error_description')
    ? 'That sign-in link has expired or was already used. Request a new one below.'
    : 'That sign-in link didn’t work. Open it in the same browser you requested it from, or request a new one.';
  return NextResponse.redirect(new URL('/login?next=' + encodeURIComponent(next) + '&error=' + encodeURIComponent(reason), request.url));
}
