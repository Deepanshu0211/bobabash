import {getAwards, getDecisions, getEvent, getResults, listProjects, requireRole} from '@/lib/portal';
import {adminAction} from '@/app/actions';
import {ActionForm, ConfirmAction, Field, Select, TextArea} from '@/components/form';
import {Empty, PageHeading, Window} from '@/components/ui';
import {ResultsBoard} from '@/components/results';

export const metadata = {title: 'Results & awards'};

export default async function AdminResults() {
  const s = await requireRole('organizer', '/admin/results');
  const [event, results, awards, decisions, wall] = await Promise.all([getEvent(), getResults(s), getAwards(s), getDecisions(s), listProjects(s, {size: 100})]);
  const phase = event?.phase;
  const closed = phase === 'closed';
  // Groups of projects sharing a standing within the top five are candidates for a tie-break.
  const ties = results ? [...new Set(results.map(r => r.standing))]
    .map(standing => results.filter(r => r.standing === standing)).filter(g => g.length > 1 && g[0].standing <= 5 && g[0].votes > 0) : [];
  const options = wall.projects.map(p => ({value: p.id, label: p.title}));
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="organizer desk · restricted" title="Results & awards">
        <p>Totals are computed from valid ballots only, never edited by hand. Verify, resolve ties with the published rubric, record judged awards, then publish.</p>
      </PageHeading>
      {results ? (
        <>
          {phase !== 'results_published' && <p className="notice restricted"><strong>Restricted:</strong> these totals are visible to organizers only. Participants see nothing until you publish.</p>}
          {ties.length > 0 && (
            <Window title="ties_detected.exe" tone="pink" reveal>
              <h2>Ties for a prize position</h2>
              {ties.map(group => (
                <div key={group[0].standing} className="tie-group">
                  <p><strong>Position {group[0].standing}:</strong> {group.map(g => `${g.title} (${g.votes})`).join(' · ')}</p>
                  {closed && (
                    <ActionForm action={adminAction} label="Record tie-break">
                      <input type="hidden" name="op" value="tiebreak"/><input type="hidden" name="position" value={group[0].standing}/>
                      {group.map(g => <input key={g.submission_id} type="hidden" name="tied" value={g.submission_id}/>)}
                      <Select label="Decision" name="winner" options={[{value: 'shared', label: 'Shared placement'}, ...group.map(g => ({value: g.submission_id, label: `${g.title} wins the tie-break`}))]}/>
                      <TextArea label="Rubric applied and rationale" name="rationale" maxLength={2000} rows={2} required/>
                    </ActionForm>
                  )}
                </div>
              ))}
            </Window>
          )}
          <ResultsBoard results={results} awards={awards} decisions={decisions}/>
        </>
      ) : <Empty title="Totals unlock when voting starts." art="drink"><p>Even organizers can’t see vote counts before the ballot box opens.</p></Empty>}

      <div className="two-col">
        {(['creative', 'best_github'] as const).map(type => {
          const current = awards.find(a => a.award_type === type);
          return (
            <Window key={type} title={type === 'creative' ? 'creative_award.exe' : 'best_github_award.exe'} tone="yellow" icon="trophy" reveal>
              <h2>{type === 'creative' ? 'Creative Award' : 'Best GitHub Award'}</h2>
              {current && <p className="small">Current: <strong>{current.submissions?.title}</strong>: {current.rationale}</p>}
              {phase !== 'results_published' ? (
                <ActionForm action={adminAction} label={current ? 'Update award' : 'Record award'}>
                  <input type="hidden" name="op" value="award"/><input type="hidden" name="award_type" value={type}/>
                  <Select label="Winning project" name="submission_id" value={current?.submission_id} options={options}/>
                  <Field label="Judging organizer or panel" name="judged_by" value={current?.judged_by ?? ''} required maxLength={200}/>
                  <TextArea label="Short rationale" name="rationale" value={current?.rationale ?? ''} maxLength={2000} rows={2} required/>
                </ActionForm>
              ) : <p className="muted small">Published.</p>}
            </Window>
          );
        })}
      </div>

      {closed && (
        <div className="finalize-bar ready" data-reveal>
          <div><strong>Ready to publish?</strong> Check totals against an independent count, record tie-breaks and both awards first.</div>
          <ConfirmAction action={adminAction} label="Publish results" title="publish_results.exe" phrase="PUBLISH" variant="coral" fields={<input type="hidden" name="op" value="publish"/>}>
            <p>Results, awards and tie-break decisions become visible to everyone. Settings freeze. This can’t be undone.</p>
          </ConfirmAction>
        </div>
      )}
    </div>
  );
}
