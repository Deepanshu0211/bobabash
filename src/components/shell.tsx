'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './icons';
import type {Role} from '@/lib/types';

type Item = {href: string; label: string; icon: string};
const NAV: {title: string; role?: Role; items: Item[]}[] = [
  {title: 'the bash', items: [
    {href: '/dashboard', label: 'Dashboard', icon: 'home'},
    {href: '/projects', label: 'Project wall', icon: 'grid'},
    {href: '/results', label: 'Results', icon: 'trophy'},
    {href: '/event-rules', label: 'Event rules', icon: 'book'}
  ]},
  {title: 'your entry', role: 'participant', items: [
    {href: '/submission', label: 'My submission', icon: 'upload'},
    {href: '/voting', label: 'Voting booth', icon: 'cup'},
    {href: '/voting/receipt', label: 'Ballot receipt', icon: 'receipt'}
  ]},
  {title: 'volunteer desk', role: 'reviewer', items: [
    {href: '/reviewer/queue', label: 'Review queue', icon: 'inbox'}
  ]},
  {title: 'organizer desk', role: 'organizer', items: [
    {href: '/admin/overview', label: 'Overview', icon: 'gauge'},
    {href: '/admin/submissions', label: 'Submissions', icon: 'list'},
    {href: '/admin/reviews', label: 'Reviews', icon: 'check'},
    {href: '/admin/shortlist', label: 'Shortlist', icon: 'star'},
    {href: '/admin/voting', label: 'Voting', icon: 'vote'},
    {href: '/admin/results', label: 'Results & awards', icon: 'trophy'},
    {href: '/admin/people', label: 'People', icon: 'people'}
  ]}
];

function useActive() {
  const pathname = usePathname();
  const all = NAV.flatMap(g => g.items.map(i => i.href));
  // Longest matching prefix wins, so /voting/receipt does not also light up /voting.
  return all.filter(h => pathname === h || pathname.startsWith(h + '/')).sort((a, b) => b.length - a.length)[0];
}

function NavList({roles, onNavigate}: {roles: Role[]; onNavigate?: () => void}) {
  const active = useActive();
  return (
    <nav aria-label="Portal" className="side-nav">
      {NAV.filter(g => !g.role || roles.includes(g.role)).map(group => (
        <div key={group.title} className="nav-group">
          <p className="nav-title">{group.title}</p>
          {group.items.map(item => (
            <Link key={item.href} href={item.href} onClick={onNavigate}
              className={'nav-link' + (active === item.href ? ' active' : '')} aria-current={active === item.href ? 'page' : undefined}>
              <Icon name={item.icon}/><span>{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({roles}: {roles: Role[]}) {
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="window tone-yellow">
        <div className="window-bar"><span className="window-title">menu.exe</span><span aria-hidden="true" className="window-controls">– □ <b>×</b></span></div>
        <div className="window-body"><NavList roles={roles}/></div>
      </div>
      <div className="sidebar-note">
        <img src="/assets/drink.png" alt="" width="46" height="64"/>
        <p>stuck? ask an organizer at the help desk, or <Link href="/event-rules">read the rules</Link>.</p>
      </div>
    </aside>
  );
}

const subscribeNothing = () => () => {};

export function MobileMenu({roles}: {roles: Role[]}) {
  const pathname = usePathname();
  // The drawer belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null);
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('drawer-open');
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.classList.remove('drawer-open'); };
  }, [open]);
  return (
    <>
      <button className="menu-button" aria-expanded={open} aria-controls="drawer" onClick={() => setOpen(true)}>
        <Icon name="menu" size={20}/><span className="sr-only">Open menu</span>
      </button>
      {mounted && createPortal(<>
      <div className={'drawer-backdrop' + (open ? ' open' : '')} onClick={() => setOpen(false)} aria-hidden="true"/>
      <div id="drawer" className={'drawer' + (open ? ' open' : '')} inert={!open} data-lenis-prevent role="dialog" aria-modal="true" aria-label="Menu">
        <div className="window tone-yellow">
          <div className="window-bar"><span className="window-title">menu.exe</span>
            <button className="dialog-close" onClick={() => setOpen(false)} aria-label="Close menu">×</button></div>
          <div className="window-body"><NavList roles={roles} onNavigate={() => setOpen(false)}/></div>
        </div>
      </div>
      </>, document.body)}
    </>
  );
}
