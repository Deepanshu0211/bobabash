import {formatDate, getEvent, listAudit, requireRole} from '@/lib/portal';
import {Empty, PageHeading, Pagination, Window} from '@/components/ui';

export const metadata = {title: 'Audit log'};

const tone = (action: string) => action.startsWith('ballot') ? 'pink' : action.startsWith('shortlist') || action.startsWith('results') ? 'lime' : action.startsWith('event') ? 'yellow' : 'blue';

export default async function Audit({searchParams}: {searchParams: Promise<Record<string, string | undefined>>}) {
  const s = await requireRole('organizer', '/admin/audit');
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1') || 1);
  const [event, {rows, total}] = await Promise.all([getEvent(), listAudit(s, page)]);
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="organizer desk" title="Audit log">
        <p>Append-only. Phase changes, assignments, shortlist decisions, ballot invalidations, awards and publication, with who did it and when. Ballot entries never record choices.</p>
      </PageHeading>
      <Window title="audit.log" icon="scroll" reveal>
        {rows.length ? (
          <ol className="audit" data-stagger>
            {rows.map(a => (
              <li key={a.id}>
                <span className={'audit-dot tone-' + tone(a.action)} aria-hidden="true"/>
                <details>
                  <summary><code className={'audit-action tone-' + tone(a.action)}>{a.action}</code><span className="muted">{formatDate(a.created_at, event?.timezone)}</span></summary>
                  <p className="small">Actor {a.actor_id ? <code>{a.actor_id.slice(0, 8)}</code> : 'trusted SQL / system'} · target {a.target_type} <code>{a.target_id ?? 'none'}</code></p>
                  <pre data-lenis-prevent>{JSON.stringify(a.details, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ol>
        ) : <Empty title="No privileged actions yet."/>}
        <Pagination page={page} total={total} size={50} href={n => '/admin/audit?page=' + n}/>
      </Window>
    </div>
  );
}
