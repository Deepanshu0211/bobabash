import Link from 'next/link';
import {getEvent, listProjects, requireSession} from '@/lib/portal';
import type {WallView} from '@/lib/types';
import {Empty, PageHeading, Pagination} from '@/components/ui';
import {ProjectCard} from '@/components/project-card';
import {Icon} from '@/components/icons';

export const metadata = {title: 'Project wall'};
const SIZE = 24;

export default async function Projects({searchParams}: {searchParams: Promise<Record<string, string | undefined>>}) {
  const s = await requireSession('/projects');
  const p = await searchParams;
  const search = (p.q ?? '').slice(0, 100);
  const page = Math.max(1, Math.min(1000, Number.parseInt(p.page ?? '1') || 1));
  const event = await getEvent();
  const frozen = Boolean(event?.shortlist_finalized_at);
  const published = event?.phase === 'results_published';
  const views: {id: WallView; label: string; show: boolean}[] = [
    {id: 'all', label: 'All', show: true},
    {id: 'eligible', label: '✓ Eligible', show: true},
    {id: 'shortlisted', label: '★ Shortlist', show: frozen},
    {id: 'winners', label: '🏆 Winners', show: published}
  ];
  const requested = views.find(v => v.id === p.view && v.show)?.id ?? 'all';
  const {projects, total} = await listProjects(s, {search, page, size: SIZE, view: requested});
  const link = (view: WallView, n?: number) => '/projects?' + new URLSearchParams({
    ...(search && {q: search}), ...(view !== 'all' && {view}), ...(n && n > 1 && {page: String(n)})
  });
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="made with curiosity" title="The project wall" art="step-build">
        <p>Every project submitted this edition. Colours and stickers show where each one stands.</p>
      </PageHeading>
      <form className="filters" action="/projects" data-reveal>
        <label className="search-field grow">
          <Icon name="search" size={16}/><span className="sr-only">Search projects</span>
          <input name="q" defaultValue={search} placeholder="Search titles and descriptions…" maxLength={100}/>
        </label>
        <div className="segmented" role="group" aria-label="Show">
          {views.filter(v => v.show).map(v => <Link key={v.id} href={link(v.id)} className={requested === v.id ? 'on' : ''}>{v.label}</Link>)}
        </div>
        {requested !== 'all' && <input type="hidden" name="view" value={requested}/>}
        <button className="button">Search</button>
      </form>
      <ul className="wall-legend" aria-label="What the colours mean" data-reveal>
        {published && <li className="state-winner">winner</li>}
        {published && <li className="state-award">judged award</li>}
        {frozen && <li className="state-shortlisted">shortlisted</li>}
        <li className="state-eligible">eligible</li>
        <li className="state-submitted">awaiting check</li>
        <li className="state-showcase">showcase (not competing)</li>
        <li className="state-ineligible">not eligible</li>
      </ul>
      <p className="muted result-count">{total} project{total === 1 ? '' : 's'}{search && <> matching “{search}”</>}</p>
      {projects.length ? (
        <div className="project-grid" data-stagger>{projects.map(project => <ProjectCard key={project.id} project={project}/>)}</div>
      ) : (
        <Empty title={search ? 'No projects match just yet.' : 'The first creations are on their way.'}>
          <p>{search ? 'Try another search.' : requested !== 'all' ? 'Nothing in this view yet.' : 'Submitted projects appear here as soon as they are sent in.'}</p>
        </Empty>
      )}
      <Pagination page={page} total={total} size={SIZE} href={n => link(requested, n)}/>
    </div>
  );
}
