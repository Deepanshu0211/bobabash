import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getEvent, getProject, requireSession} from '@/lib/portal';
import {votingOpen} from '@/lib/rules.mjs';
import {idSchema} from '@/lib/validation';
import {Badge, Cover, ExternalLinks, Window} from '@/components/ui';
import {Icon} from '@/components/icons';
import {PRIZE_NAMES, StatusTag} from '@/components/project-card';

export const metadata = {title: 'Project'};

export default async function ProjectDetail({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const s = await requireSession('/projects/' + id);
  const [event, project] = await Promise.all([getEvent(), getProject(s, id)]);
  if (!project) notFound();
  const canVote = s.roles.includes('participant') && votingOpen(event) && project.is_shortlisted && !project.is_mine;
  return (
    <div className="stack-lg">
      <Link href="/projects" className="back-link">← All projects</Link>
      <div className="detail-grid">
        <div className="stack">
          <div className="detail-cover" data-reveal><Cover id={project.id} src={project.cover} title={project.title} size="hero"/></div>
          <Window title="behind_the_build.txt" reveal>
            <p className="eyebrow">{project.category}</p>
            <h1 className="detail-title">{project.title}</h1>
            <p className="prose">{project.description}</p>
            <ExternalLinks demo={project.demo_url} repo={project.repository_url}/>
          </Window>
        </div>
        <aside className="stack detail-aside">
          <Window title="about.exe" tone="yellow" reveal>
            {project.creator_name && <><p className="eyebrow">made by</p><h2>{project.creator_name}</h2></>}
            <p className="badge-row">
              <Badge tone="cream">{project.category}</Badge>
              <StatusTag project={project}/>
              {project.is_shortlisted && <Badge tone="lime">★ shortlisted</Badge>}
              {project.standing && <Badge tone="yellow">🏆 #{project.standing} in the vote</Badge>}
              {project.prizes?.map(k => <Badge key={k} tone="pink">✦ {PRIZE_NAMES[k]}</Badge>)}
              {project.is_mine && <Badge tone="pink">your project</Badge>}
            </p>
          </Window>
          {canVote && (
            <Window title="voting_booth.exe" tone="pink" reveal>
              <p>This project is on the shortlist. Add it to your cup in the voting booth.</p>
              <Link className="button coral" href="/voting"><Icon name="cup" size={16}/>Go vote</Link>
            </Window>
          )}
        </aside>
      </div>
    </div>
  );
}
