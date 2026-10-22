import Link from 'next/link';
import {requireSession, getEvent} from '@/lib/portal';
import {MobileMenu, Sidebar} from '@/components/shell';
import {PhaseChip} from '@/components/phase';
import {Icon} from '@/components/icons';
import {Badge} from '@/components/ui';
import {NameDialog} from '@/components/name-dialog';
import {initials} from '@/lib/rules.mjs';
import {signOut} from '../actions';

// The signed-in portal is private: keep it out of search results.
export const metadata = {robots: {index: false, follow: false}};

export default async function PortalLayout({children}: {children: React.ReactNode}) {
  const s = await requireSession();
  const event = await getEvent();
  const name = s.displayName;

  if (!s.roles.length) {
    return (
      <div className="portal">
        <main id="main" className="not-rostered">
          <section className="window tone-pink">
            <div className="window-bar"><span className="window-title">access_denied.exe</span></div>
            <div className="window-body">
              <img src="/assets/step-signup.png" alt="" width="140" height="140"/>
              <h1>This email isn’t on the roster yet.</h1>
              <p>You signed in as <strong>{s.email}</strong>. Only registered participants, volunteers and organizers can use the portal. If you think this is a mistake, ask an organizer to check the roster.</p>
              <form action={signOut}><button className="button">Sign out</button></form>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="portal">
      <header className="topbar">
        <MobileMenu roles={s.roles}/>
        <Link href="/dashboard" className="brand" aria-label="Boba Bash dashboard">
          <img src="/assets/logo.png" alt="" width="62" height="41"/>
          <span>portal<small>{event?.name ?? 'Boba Bash'}</small></span>
        </Link>
        <PhaseChip event={event}/>
        <div className="user-chip">
          <span className="avatar" aria-hidden="true">{initials(name)}</span>
          <span className="user-meta"><strong>{name}</strong><span>{s.roles.map(r => <Badge key={r} status={r}/>)}</span></span>
          <NameDialog required={!s.name} suggestion={s.name ?? s.participant?.display_name ?? ''}/>
          <form action={signOut}><button className="icon-button" aria-label="Sign out" title="Sign out"><Icon name="logout"/></button></form>
        </div>
      </header>
      <div className="portal-grid">
        <Sidebar roles={s.roles}/>
        <main id="main" className="portal-main">{children}</main>
      </div>
    </div>
  );
}
