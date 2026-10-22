import Link from 'next/link';
import {getEvent, listMyAssignments, requireRole} from '@/lib/portal';
import {Badge, Cover, Empty, ExternalLinks, PageHeading, Progress} from '@/components/ui';
import {CountUp} from '@/components/motion';

export const metadata = {title: 'Review queue'};

export default async function Queue({searchParams}: {searchParams: Promise<Record<string, string | undefined>>}) {
  const s = await requireRole('reviewer', '/reviewer/queue');
  const view = (await searchParams).view === 'done' ? 'done' : 'todo';
  const [event, assignments] = await Promise.all([getEvent(), listMyAssignments(s)]);
  const done = assignments.filter(a => a.status === 'completed');
  const todo = assignments.filter(a => a.status !== 'completed');
  const shown = view === 'done' ? done : todo;
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="volunteer desk" title="Your review queue" art="step-build">
        <p>Open the demo and repository, check eligibility, then recommend. Missing reviews hold a project as pending, so every one counts.</p>
      </PageHeading>
      <div className="queue-progress" data-reveal>
        <div>
          <strong className="big-number"><CountUp value={done.length}/><small>/{assignments.length}</small></strong>
          <span>reviews complete</span>
        </div>
        <Progress value={done.length} max={assignments.length} label="Reviews complete"/>
        <p className="muted">{event?.phase === 'review' ? 'Reviews are open until organizers freeze the shortlist.' : 'Reviews open when organizers start the review stage.'}</p>
      </div>
      <div className="segmented" role="tablist" aria-label="Filter">
        <Link href="/reviewer/queue" className={view === 'todo' ? 'on' : ''} role="tab" aria-selected={view === 'todo'}>To review <b>{todo.length}</b></Link>
        <Link href="/reviewer/queue?view=done" className={view === 'done' ? 'on' : ''} role="tab" aria-selected={view === 'done'}>Done <b>{done.length}</b></Link>
      </div>
      {shown.length ? (
        <div className="queue-list" data-stagger>
          {shown.map(a => a.submissions && (
            <article key={a.id} className={'queue-item status-' + a.status}>
              <div className="queue-thumb"><Cover id={a.submission_id} src={a.submissions.cover} title={a.submissions.title}/></div>
              <div className="queue-main">
                <div className="row"><h2><Link href={'/reviewer/projects/' + a.id} className="stretched">{a.submissions.title}</Link></h2><Badge status={a.status}/></div>
                <p>{a.submissions.description}</p>
                <div className="row">
                  <ExternalLinks demo={a.submissions.demo_url} repo={a.submissions.repository_url} compact/>
                  {a.reviews && <Badge status={a.reviews.recommendation}>{a.reviews.recommendation === 'reject' ? 'don’t shortlist' : a.reviews.recommendation}</Badge>}
                </div>
              </div>
              <span className="queue-go" aria-hidden="true">→</span>
            </article>
          ))}
        </div>
      ) : (
        <Empty title={view === 'todo' ? (assignments.length ? 'All caught up. Thank you!' : 'No assignments yet.') : 'Nothing reviewed yet.'} art={view === 'todo' && assignments.length ? 'step-boba' : 'drink'}>
          <p>{view === 'todo' && !assignments.length ? 'Organizers will assign projects once submissions close.' : 'Take a boba break.'}</p>
        </Empty>
      )}
    </div>
  );
}
