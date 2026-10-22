import Link from 'next/link';
import type {ReactNode} from 'react';
import {Badge, Cover} from './ui';
import type {WallProject} from '@/lib/types';

const MEDALS = {1: '1st place', 2: '2nd place', 3: '3rd place'} as const;
export const PRIZE_NAMES = {creative: 'Creative Award', best_github: 'Best GitHub Award'} as const;

/** One look per state, strongest first: winner, award, shortlisted, eligible, awaiting check, showcase, ineligible. */
export function wallState(p: WallProject) {
  if (p.standing) return 'winner';
  if (p.prizes?.length) return 'award';
  if (p.is_shortlisted) return 'shortlisted';
  return p.status;
}

export function StatusTag({project}: {project: WallProject}) {
  if (project.status === 'showcase') return <Badge tone="cream">showcase</Badge>;
  if (project.status === 'ineligible') return <Badge tone="muted">not eligible</Badge>;
  if (project.status === 'submitted') return <Badge tone="yellow">awaiting check</Badge>;
  return <Badge tone="lime">✓ eligible</Badge>;
}

export function ProjectCard({project, footer, href = '/projects/' + project.id, selected = false}: {
  project: WallProject; footer?: ReactNode; href?: string | null; selected?: boolean;
}) {
  const title = href ? <Link href={href} className="stretched">{project.title}</Link> : project.title;
  const medal = project.standing as 1 | 2 | 3 | null;
  return (
    <article className={`project-card state-${wallState(project)}` + (selected ? ' selected' : '') + (project.is_mine ? ' mine' : '')}>
      <div className="project-cover">
        <Cover id={project.id} src={project.cover} title={project.title}/>
        {medal && <span className={`medal-badge place-${medal}`}><b aria-hidden="true">{medal}</b>{MEDALS[medal]}</span>}
        {!medal && project.is_shortlisted && <span className="sticker">★ shortlisted</span>}
        {project.is_mine && <span className="sticker mine-sticker">your project</span>}
      </div>
      {project.prizes?.length ? (
        <div className="prize-ribbons">{project.prizes.map(k => <span key={k} className={'prize-ribbon prize-' + k}>✦ {PRIZE_NAMES[k]}</span>)}</div>
      ) : null}
      <div className="project-card-body">
        <div className="row"><Badge tone="cream">{project.category}</Badge><StatusTag project={project}/></div>
        <h2>{title}</h2>
        {project.creator_name && <small className="muted card-by">by {project.creator_name}</small>}
        <p>{project.description}</p>
        {footer && <div className="card-footer">{footer}</div>}
      </div>
    </article>
  );
}
