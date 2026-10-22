import {getEvent, getTally, listAllAssignments, listStaff, requireRole} from '@/lib/portal';
import {adminAction} from '@/app/actions';
import {ActionForm, ConfirmAction, Field, Select} from '@/components/form';
import {Badge, Empty, PageHeading, Progress, Window} from '@/components/ui';
import {Icon} from '@/components/icons';
import {initials} from '@/lib/rules.mjs';

export const metadata = {title: 'Reviews'};
const mark = {shortlist: '✓', reject: '✕', flag: '⚑'} as const;

export default async function AdminReviews() {
  const s = await requireRole('organizer', '/admin/reviews');
  const [event, tally, assignments, staff] = await Promise.all([getEvent(), getTally(s), listAllAssignments(s), listStaff(s)]);
  const reviewers = staff.filter(r => r.role === 'reviewer');
  const joined = reviewers.filter(r => r.user_id);
  const name = (id: string) => reviewers.find(r => r.user_id === id)?.display_name ?? 'reviewer';
  const editable = event?.phase === 'submissions' || event?.phase === 'review';
  const total = assignments.length, complete = assignments.filter(a => a.status === 'completed').length;
  const under = tally.filter(t => t.assigned < 3).length;
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="organizer desk" title="Volunteer reviews">
        <p>Three independent reviewers per eligible project. Assignments are balanced automatically and never include a reviewer’s own project.</p>
      </PageHeading>

      <div className="two-col">
        <Window title="workload.exe" tone="lime" icon="people" reveal>
          <div className="row"><h2>Volunteers</h2><span className="muted">{complete}/{total} reviews</span></div>
          <Progress value={complete} max={total} label="All reviews"/>
          <ul className="workload">
            {reviewers.map(r => (
              <li key={r.email}>
                <span className="avatar small" aria-hidden="true">{initials(r.display_name)}</span>
                <span className="workload-name"><strong>{r.display_name}</strong>{!r.joined && <small>hasn’t signed in</small>}</span>
                <span className="workload-bar"><Progress value={r.completed} max={r.assigned || 1} label={r.display_name}/></span>
                <small>{r.completed}/{r.assigned}</small>
              </li>
            ))}
            {!reviewers.length && <li className="muted">Invite volunteers on the People page.</li>}
          </ul>
        </Window>

        <Window title="assign.exe" tone="yellow" icon="shuffle" reveal>
          <h2>Auto-assign</h2>
          <p className="small">Tops up every eligible project to the target number of reviewers, least-loaded volunteer first. {under ? <strong>{under} project(s) need reviewers.</strong> : 'Every project is fully assigned.'}</p>
          <ConfirmAction action={adminAction} label="Auto-assign reviewers" title="auto_assign.exe" variant="coral" disabled={!editable || !joined.length}
            fields={<><input type="hidden" name="op" value="auto"/><Field label="Reviewers per project" name="per_project" type="number" value={3}/></>}>
            <p>Creates the missing assignments for all {tally.length} eligible projects across {joined.length} signed-in volunteers.</p>
          </ConfirmAction>
          <hr/>
          <h2>Manual assignment</h2>
          {editable && tally.length && joined.length ? (
            <ActionForm action={adminAction} label="Assign">
              <input type="hidden" name="op" value="assign"/>
              <Select label="Project" name="submission_id" options={tally.map(t => ({value: t.submission_id, label: `${t.title} (${t.assigned})`}))}/>
              <Select label="Volunteer" name="reviewer_id" options={joined.map(r => ({value: r.user_id!, label: `${r.display_name} (${r.assigned})`}))}/>
            </ActionForm>
          ) : <p className="muted small">{editable ? 'Needs eligible projects and signed-in volunteers.' : 'Assignments are frozen with the shortlist.'}</p>}
        </Window>
      </div>

      <Window title="review_matrix.csv" icon="list" reveal>
        {tally.length ? (
          <div className="matrix" data-lenis-prevent>
            {tally.map(t => (
              <div key={t.submission_id} className="matrix-row">
                <span className="matrix-title"><strong>{t.title}</strong><Badge status={t.outcome}/></span>
                <span className="matrix-cells">
                  {assignments.filter(a => a.submission_id === t.submission_id).map(a => (
                    <span key={a.id} className={'cell cell-' + (a.reviews?.recommendation ?? a.status)} title={`${name(a.reviewer_id)}: ${a.reviews?.recommendation ?? a.status}`}>
                      <b aria-hidden="true">{a.reviews ? mark[a.reviews.recommendation] : '…'}</b>
                      <small>{name(a.reviewer_id)}</small>
                      {editable && !a.reviews && (
                        <ActionForm action={adminAction} label="×" variant="cell-remove">
                          <input type="hidden" name="op" value="unassign"/><input type="hidden" name="id" value={a.id}/>
                        </ActionForm>
                      )}
                    </span>
                  ))}
                  {Array.from({length: Math.max(0, 3 - t.assigned)}, (_, i) => <span key={'gap' + i} className="cell cell-gap" title="Needs a reviewer"><Icon name="people" size={14}/><small>open</small></span>)}
                </span>
              </div>
            ))}
          </div>
        ) : <Empty title="No eligible projects yet."><p>Mark submissions eligible first.</p></Empty>}
      </Window>
    </div>
  );
}
