import Link from 'next/link';
import {getEvent, listSubmissions, requireRole, formatDate} from '@/lib/portal';
import {adminAction} from '@/app/actions';
import {ActionForm, Field} from '@/components/form';
import {Badge, Empty, ExternalLinks, PageHeading} from '@/components/ui';
import {Icon} from '@/components/icons';

export const metadata = {title: 'Submissions'};
const FILTERS = ['', 'submitted', 'eligible', 'ineligible', 'draft', 'withdrawn'];

export default async function AdminSubmissions({searchParams}: {searchParams: Promise<Record<string, string | undefined>>}) {
  const s = await requireRole('organizer', '/admin/submissions');
  const p = await searchParams;
  const status = FILTERS.includes(p.status ?? '') ? p.status ?? '' : '';
  const search = (p.q ?? '').slice(0, 100);
  const [event, rows] = await Promise.all([getEvent(), listSubmissions(s, {status, search})]);
  const checking = event?.phase === 'submissions' || event?.phase === 'review';
  const qs = (st: string) => '/admin/submissions?' + new URLSearchParams({...(st && {status: st}), ...(search && {q: search})});
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="organizer desk" title="Submissions & eligibility">
        <p>Check each submitted project against the published criteria. Only eligible projects go to volunteer review. Reasons are logged.</p>
      </PageHeading>
      <div className="toolbar" data-reveal>
        <div className="segmented" role="group" aria-label="Status filter">
          {FILTERS.map(f => <Link key={f || 'all'} href={qs(f)} className={status === f ? 'on' : ''}>{f || 'all'}</Link>)}
        </div>
        <form action="/admin/submissions" className="search-inline">
          {status && <input type="hidden" name="status" value={status}/>}
          <label className="search-field"><Icon name="search" size={16}/><span className="sr-only">Search titles</span><input name="q" defaultValue={search} placeholder="Search titles…"/></label>
        </form>
        <a className="button secondary" href={`/api/admin/submissions?format=csv${status ? '&status=' + status : ''}`} download><Icon name="download" size={15}/>Export CSV</a>
      </div>
      {!checking && <p className="notice">Eligibility is frozen with the shortlist. Use emergency correction on the Shortlist page if a project is later found ineligible.</p>}
      {rows.length ? (
        <div className="admin-list" data-stagger>
          {rows.map(r => (
            <details key={r.id} className="admin-row">
              <summary>
                <span className="admin-row-title"><strong>{r.title}</strong><small>{r.participants?.display_name} · {r.participants?.email}</small></span>
                <span className="badge-row">{r.participants?.track === 'showcase' && <Badge tone="cream">showcase</Badge>}<Badge status={r.status}/>{r.shortlist_status !== 'pending' && <Badge status={r.shortlist_status}/>}</span>
                <span className="chev" aria-hidden="true">▾</span>
              </summary>
              <div className="admin-row-body">
                <p className="prose">{r.description}</p>
                <ExternalLinks demo={r.demo_url} repo={r.repository_url} compact/>
                <p className="small muted">Category {r.category} · submitted {formatDate(r.submitted_at, event?.timezone)}{r.eligibility_reason && <> · reason: {r.eligibility_reason}</>}</p>
                {r.participants?.track === 'showcase' && <p className="notice">Showcase project (only organizers see this). Check it like any other so it looks normal; it skips review and is never shortlisted.</p>}
                {checking && ['submitted', 'eligible', 'ineligible'].includes(r.status) && (
                  <div className="decision-forms">
                    <ActionForm action={adminAction} label="✓ Mark eligible" variant="lime">
                      <input type="hidden" name="op" value="eligibility"/><input type="hidden" name="id" value={r.id}/><input type="hidden" name="eligible" value="true"/>
                    </ActionForm>
                    <ActionForm action={adminAction} label="Mark ineligible" variant="danger">
                      <input type="hidden" name="op" value="eligibility"/><input type="hidden" name="id" value={r.id}/><input type="hidden" name="eligible" value="false"/>
                      <Field label="Reason (shared with the participant)" name="reason" required maxLength={1000} placeholder="Which published criterion does it miss?"/>
                    </ActionForm>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      ) : <Empty title="Nothing here."><p>No submissions match this filter.</p></Empty>}
    </div>
  );
}
