import Link from 'next/link';
import {redirect} from 'next/navigation';
import {signOut} from '@/app/actions';
import {LoginForm} from '@/components/login-form';
import {Window} from '@/components/ui';
import {configured} from '@/lib/supabase/config';
import {directEntryConfigured} from '@/lib/supabase/admin';
import {getSession} from '@/lib/portal';
import {safeNext} from '@/lib/security.mjs';

export const metadata = {title: 'Sign in', description: 'Sign in to the Boba Bash Lucknow portal with your registered email.', robots: {index: false, follow: true}};

export default async function Login({searchParams}: {searchParams: Promise<Record<string, string | undefined>>}) {
  const p = await searchParams;
  const next = safeNext(p.next);
  const session = await getSession();
  // Only rostered accounts continue; anyone else stays here (the proxy sends them back too).
  if (session?.roles.length) redirect(next);
  const denied = Boolean(session) || p.denied === '1';
  // Only reveal whether a code exists, never the code itself.
  const eventCode = Boolean(process.env.EVENT_ACCESS_CODE);
  return (
    <div className="auth-shell">
      <img className="auth-mascot" src="/assets/step-signup.png" alt="" width="150" height="150" data-parallax="-0.08"/>
      <Window title="welcome_to_the_club.exe" tone="blue">
        <p className="eyebrow">event portal</p>
        <h1>Hey, builder. Welcome in.</h1>
        <p>{directEntryConfigured ? 'Type the email you registered with and you’re in.' : 'Sign in with the email you registered with. We’ll send a one-time link.'}</p>
        {p.error && <p role="alert" className="notice error-notice">{p.error}</p>}
        {denied && session ? (
          <div className="notice error-notice" role="alert">
            <p><strong>{session.email}</strong> isn’t on the event roster, so the portal stays closed for this account.</p>
            <p>If you registered with another email, sign out and use that one. Otherwise, ask an organizer to add you.</p>
            <form action={signOut}><button className="button secondary">Sign out</button></form>
          </div>
        ) : configured ? (
          <LoginForm next={next} direct={directEntryConfigured} eventCode={eventCode}/>
        ) : (
          <p className="notice">Sign-in opens once the organizers finish connecting this event. Come back soon.</p>
        )}
        <p className="small muted auth-foot">Only the registered participants, volunteers and organizers on the event roster can enter. <Link href="/event-rules">Read the rules</Link>.</p>
      </Window>
    </div>
  );
}
