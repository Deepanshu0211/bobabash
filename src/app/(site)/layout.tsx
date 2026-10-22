import Link from 'next/link';
import {formatEventDay, getEvent, getSession} from '@/lib/portal';
import {signOut} from '../actions';

export default async function SiteLayout({children}: {children: React.ReactNode}) {
  const [session, event] = await Promise.all([getSession(), getEvent()]);
  const community = process.env.NEXT_PUBLIC_COMMUNITY_URL;
  return (
    <>
      <header className="site-header">
        <Link href="/" aria-label="Boba Bash home"><img src="/assets/hack-club.png" alt="Hack Club" width="74" height="34"/></Link>
        <nav aria-label="Main navigation">
          <Link href="/">home</Link>
          <Link href="/#about">about</Link>
          <Link href="/event-rules">rules</Link>
          <Link href="/#faq">FAQ</Link>
          {session ? <>
            <Link href="/dashboard">dashboard</Link>
            <form action={signOut}><button className="nav-signup">sign out</button></form>
          </> : <Link className="nav-signup" href="/login">enter the portal ↗</Link>}
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <img className="footer-paper" src="/assets/paper-top.png" alt=""/>
        <div className="footer-inner">
          <div className="footer-brand">
            <Link href="/" aria-label="Boba Bash home"><img src="/assets/logo.png" alt="Boba Bash" width="180" height="119"/></Link>
            <p>made with <span className="coral">♡</span> by builders, for builders.<br/>a little code, a lot of community.</p>
          </div>
          <nav className="footer-col" aria-label="Footer">
            <h2>explore</h2>
            <Link href="/#about">What is it?</Link>
            <Link href="/event-rules">How voting works</Link>
            <Link href="/#faq">FAQ</Link>
            <Link href={session ? '/dashboard' : '/login'}>{session ? 'Your dashboard' : 'Enter the portal'}</Link>
            {community && /^https:\/\//.test(community) && <a href={community} target="_blank" rel="noreferrer">Community ↗</a>}
          </nav>
          <div className="footer-col">
            <h2>the bash</h2>
            <p>{formatEventDay(event) ?? 'Date coming soon'}</p>
            {event?.venue_name && <p>{event.venue_name}</p>}
            {event?.venue_address && <p className="muted">{event.venue_address}</p>}
          </div>
          <img className="footer-boba" src="/assets/drink.png" alt="" width="70" height="98"/>
        </div>
        <div className="footer-bottom">
          <small>Boba Bash · a Hack Club event</small>
        
        </div>
      </footer>
    </>
  );
}
