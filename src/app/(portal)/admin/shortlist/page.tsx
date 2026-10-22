import {getEvent, getTally, requireRole} from '@/lib/portal';
import {adminAction} from '@/app/actions';
import {ActionForm, ConfirmAction, Field, Select, TextArea} from '@/components/form';
import {Badge, Empty, PageHeading, Window} from '@/components/ui';

export const metadata = {title: 'Shortlist'};
const outcomeCopy = {pass: 'passes majority', fail: 'does not pass', pending: 'reviews missing', flagged: 'flagged, needs organizer'} as const;

export default async function Shortlist() {
  const s = await requireRole('organizer', '/admin/shortlist');
  const [event, tally] = await Promise.all([getEvent(), getTally(s)]);
  const reviewing = event?.phase === 'review';
  const frozen = Boolean(event?.shortlist_finalized_at);
  const blocked = tally.filter(t => !t.resolution && (t.outcome === 'pending' || t.outcome === 'flagged'));
  const passing = tally.filter(t => t.resolution ? t.resolution === 'shortlisted' : t.outcome === 'pass').length;
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="organizer desk" title={frozen ? 'The frozen shortlist' : 'Volunteer-majority shortlist'}>
        <p>A project passes with a strict majority of completed reviews. Missing reviews are pending, flags are held for you, and any exception you record is logged with its reason.</p>
      </PageHeading>

      {!frozen && (
        <div className={'finalize-bar' + (blocked.length ? '' : ' ready')} data-reveal>
          <div>
            <strong>{passing} of {tally.length}</strong> projects on track for the shortlist.
            {blocked.length ? <span> {blocked.length} still need reviews or a decision.</span> : <span> Everything is decided.</span>}
          </div>
          <ConfirmAction action={adminAction} label="Finalize & freeze shortlist" title="finalize_shortlist.exe" phrase="FINALIZE" variant="coral"
            disabled={!reviewing || blocked.length > 0} fields={<input type="hidden" name="op" value="finalize"/>}>
            <p>This computes every majority outcome, applies your documented exceptions, and <strong>freezes the shortlist</strong>. After this, only a logged emergency correction can remove a project.</p>
          </ConfirmAction>
        </div>
      )}

      <Window title="tally.csv" icon="star" reveal>
        {tally.length ? (
          <div className="tally" data-lenis-prevent>
            <div className="tally-head" aria-hidden="true"><span>project</span><span>reviews</span><span>outcome</span><span>decision</span></div>
            {tally.map(t => (
              <div key={t.submission_id} className={'tally-row outcome-' + t.outcome}>
                <span className="tally-title"><strong>{t.title}</strong>{frozen && <Badge status={t.shortlist_status}/>}</span>
                <span className="votes-dots" aria-label={`${t.shortlist_votes} shortlist, ${t.reject_votes} reject, ${t.flag_votes} flag, ${t.assigned - t.completed} missing`}>
                  {Array.from({length: t.shortlist_votes}, (_, i) => <i key={'s' + i} className="dot yes">✓</i>)}
                  {Array.from({length: t.reject_votes}, (_, i) => <i key={'r' + i} className="dot no">✕</i>)}
                  {Array.from({length: t.flag_votes}, (_, i) => <i key={'f' + i} className="dot flag">⚑</i>)}
                  {Array.from({length: Math.max(0, Math.max(3, t.assigned) - t.completed)}, (_, i) => <i key={'m' + i} className="dot missing">·</i>)}
                </span>
                <span><Badge status={t.outcome}>{outcomeCopy[t.outcome]}</Badge></span>
                <span className="tally-decision">
                  {t.resolution ? <><Badge status={t.resolution}>exception: {t.resolution.replace('_', ' ')}</Badge><small>{t.resolution_reason}</small></> : <small className="muted">majority rule</small>}
                  {reviewing && (
                    <details className="inline-details">
                      <summary>{t.resolution ? 'change' : 'record exception'}</summary>
                      <ActionForm action={adminAction} label="Save decision">
                        <input type="hidden" name="op" value="resolve"/><input type="hidden" name="id" value={t.submission_id}/>
                        <Select label="Outcome" name="outcome" value={t.resolution ?? 'shortlisted'} options={[
                          {value: 'shortlisted', label: 'Shortlist (exception)'}, {value: 'not_shortlisted', label: 'Do not shortlist (exception)'}, {value: 'pending', label: 'Clear exception'}
                        ]}/>
                        <TextArea label="Documented reason (10+ characters)" name="reason" value={t.resolution_reason ?? ''} maxLength={1000} rows={2}/>
                      </ActionForm>
                    </details>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : <Empty title="No eligible projects yet."/>}
      </Window>

      {frozen && ['shortlist_frozen', 'voting', 'closed'].includes(event?.phase ?? '') && (
        <Window title="emergency_correction.exe" tone="pink" reveal>
          <h2>Emergency correction</h2>
          <p className="small">Only for a shortlisted project later found ineligible. It is removed from the ballot and results, and the reason is logged permanently.</p>
          <ConfirmAction action={adminAction} label="Remove from shortlist" title="emergency_removal.exe" phrase="REMOVE" variant="danger"
            fields={<>
              <input type="hidden" name="op" value="emergency"/>
              <Select label="Project" name="id" options={tally.filter(t => t.shortlist_status === 'shortlisted').map(t => ({value: t.submission_id, label: t.title}))}/>
              <Field label="Documented reason (20+ characters)" name="reason" required maxLength={1000}/>
            </>}>
            <p>Ballots that included this project stay valid, but the project will no longer receive points.</p>
          </ConfirmAction>
        </Window>
      )}
    </div>
  );
}
