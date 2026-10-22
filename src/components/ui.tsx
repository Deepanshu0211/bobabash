import Link from 'next/link';
import type {ReactNode} from 'react';
import {Icon} from './icons';
import {artFor} from '@/lib/rules.mjs';

type Tone = 'blue' | 'yellow' | 'pink' | 'lime' | 'cream';

export function Window({title, children, className = '', tone = 'blue', icon, reveal = false, draggable = false}: {
  title: string; children: ReactNode; className?: string; tone?: Tone; icon?: string; reveal?: boolean; draggable?: boolean;
}) {
  return (
    <section className={`window tone-${tone} ${className}`} data-reveal={reveal || undefined}>
      <div className="window-bar" {...(draggable && {'data-drag-handle': true, tabIndex: 0, title: 'Drag to move. Double-click to reset.', 'aria-label': `${title} window. Drag or use arrow keys to move.`})}>
        <span className="window-title">{icon && <Icon name={icon} size={13}/>}{title}</span>
        <span aria-hidden="true" className="window-controls">– □ <b>×</b></span>
      </div>
      <div className="window-body">{children}</div>
    </section>
  );
}

export function PageHeading({eyebrow, title, children, art}: {eyebrow: string; title: string; children?: ReactNode; art?: string}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </div>
      {art && <img className="heading-art" src={`/assets/${art}.png`} alt="" data-parallax="-0.06"/>}
    </header>
  );
}

export function Empty({title, children, art = 'drink'}: {title: string; children?: ReactNode; art?: string}) {
  return (
    <div className="empty" data-reveal>
      <img src={`/assets/${art}.png`} alt="" width="86" height="86" className="empty-art"/>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

const statusTone: Record<string, string> = {
  draft: 'muted', submitted: 'blue', eligible: 'lime', ineligible: 'coral', withdrawn: 'muted',
  pending: 'yellow', shortlisted: 'lime', not_shortlisted: 'muted', assigned: 'yellow', in_progress: 'blue', completed: 'lime',
  pass: 'lime', fail: 'coral', flagged: 'yellow', valid: 'lime', invalidated: 'coral',
  shortlist: 'lime', reject: 'coral', flag: 'yellow', participant: 'blue', reviewer: 'lime', organizer: 'pink'
};
export function Badge({children, tone, status}: {children?: ReactNode; tone?: string; status?: string}) {
  const t = tone ?? (status ? statusTone[status] : 'blue') ?? 'blue';
  return <span className={`badge badge-${t}`}>{children ?? status?.replaceAll('_', ' ')}</span>;
}

export function Progress({value, max, label}: {value: number; max: number; label?: string}) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span style={{'--pct': pct + '%'} as React.CSSProperties}/>
    </div>
  );
}

export function Pearls({filled, total = 3, label}: {filled: number; total?: number; label?: string}) {
  return (
    <span className="pearls" aria-label={label ?? `${filled} of ${total}`}>
      {Array.from({length: total}, (_, i) => <i key={i} className={i < filled ? 'on' : ''} style={{animationDelay: i * 90 + 'ms'}}/>)}
    </span>
  );
}

const ART = ['step-build', 'step-boba', 'step-signup', 'drink'];
const TINTS = ['#d4f0fa', '#edf4b7', '#fde3d8', '#fff1c9', '#e4dcf7'];
/** Every card cover has the same frame: a real cover, or a stable mascot illustration on a tinted grid. */
export function Cover({id, src, title, size = 'card'}: {id: string; src?: string | null; title: string; size?: 'card' | 'hero'}) {
  return (
    <div className={`cover cover-${size}`} style={{'--tint': artFor(id + 't', TINTS)} as React.CSSProperties}>
      {src ? <img src={src} alt={`${title} cover`} loading="lazy"/>
        : <img className="cover-art" src={`/assets/${artFor(id, ART)}.png`} alt="" loading="lazy"/>}
    </div>
  );
}

export function Stat({label, value, icon, hint}: {label: string; value: ReactNode; icon?: string; hint?: string}) {
  return (
    <div className="stat" data-reveal>
      {icon && <span className="stat-icon"><Icon name={icon} size={18}/></span>}
      <strong>{value}</strong>
      <small>{label}</small>
      {hint && <em>{hint}</em>}
    </div>
  );
}

export function Pagination({page, total, size, href}: {page: number; total: number; size: number; href: (page: number) => string}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="pagination">
      {page > 1 && <Link className="button secondary" href={href(page - 1)}>← Previous</Link>}
      <span>Page {page} of {pages}</span>
      {page < pages && <Link className="button secondary" href={href(page + 1)}>Next →</Link>}
    </nav>
  );
}

export function ExternalLinks({demo, repo, compact = false}: {demo: string | null; repo: string | null; compact?: boolean}) {
  return (
    <div className="button-row">
      {demo && <a className={'button' + (compact ? ' small-button' : '')} href={demo} target="_blank" rel="noreferrer noopener"><Icon name="external" size={15}/>Open demo</a>}
      {repo && <a className={'button secondary' + (compact ? ' small-button' : '')} href={repo} target="_blank" rel="noreferrer noopener"><Icon name="github" size={15}/>Repository</a>}
    </div>
  );
}
