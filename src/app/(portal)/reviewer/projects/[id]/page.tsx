import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getEvent, getMyAssignment, requireRole} from '@/lib/portal';
import {Badge, Cover, ExternalLinks, Window} from '@/components/ui';
import {ReviewForm} from '@/components/review-form';

export const metadata = {title: 'Review project'};

export default async function ReviewProject({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const s = await requireRole('reviewer', '/reviewer/projects/' + id);
  const [event, a] = await Promise.all([getEvent(), getMyAssignment(s, id)]);
  // Knowing an assignment id is not enough: getMyAssignment only returns the caller's own.
  if (!a?.submissions) notFound();
  const p = a.submissions;
  // Manual control: reviews are open exactly while organizers keep the event in review.
  const locked = event?.phase !== 'review' || p.status !== 'eligible';
  return (
    <div className="stack-lg">
      <Link href="/reviewer/queue" className="back-link">← Review queue</Link>
      <div className="review-grid">
        <div className="stack">
          <Window title="quick_check.exe" tone="yellow" className="quick-check" reveal>
            <div>
              <p className="eyebrow">{p.category}</p>
              <h1 className="detail-title">{p.title}</h1>
            </div>
            <ExternalLinks demo={p.demo_url} repo={p.repository_url}/>
          </Window>
          <div className="detail-cover" data-reveal><Cover id={p.id} src={p.cover} title={p.title} size="hero"/></div>
          <Window title="description.txt" reveal>
            <p className="prose">{p.description}</p>
          </Window>
        </div>
        <aside className="review-aside">
          <Window title="my_review.exe" tone="lime" reveal>
            <div className="row"><h2>Your recommendation</h2><Badge status={a.status}/></div>
            <p className="small muted">Independent and private: other volunteers can’t see your review. Judge eligibility and the published criteria, not popularity.</p>
            <ReviewForm assignmentId={a.id} review={a.reviews} status={a.status} locked={locked}/>
          </Window>
        </aside>
      </div>
    </div>
  );
}
