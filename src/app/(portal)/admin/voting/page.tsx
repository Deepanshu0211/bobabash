import {formatDate, getEvent, getOverview, listBallots, listVoteCounts, requireRole} from '@/lib/portal';
import {adminAction} from '@/app/actions';
import {ConfirmAction, Field, TextArea} from '@/components/form';
import {Badge, Empty, PageHeading, Progress, Stat, Window} from '@/components/ui';
import {CountUp} from '@/components/motion';

export const metadata = {title: 'Voting'};

const phase0 = (p?: string) => p === 'voting' || p === 'closed';

export default async function AdminVoting() {
  const s = await requireRole('organizer', '/admin/voting');
  const [event, stats, ballots] = await Promise.all([getEvent(), getOverview(s), listBallots(s)]);
  // Null when the live database doesn't have the vote-edit patch yet.
  const counts = await listVoteCounts(s).catch(() => null);
  const canEdit = phase0(event?.phase);
  const totalBallots = (counts ?? []).reduce((n, c) => n + Number(c.ballots), 0);
  const totalVotes = (counts ?? []).reduce((n, c) => n + Number(c.total), 0);
  // Showcase participants don't vote, so turnout counts the competition only.
  const voters = Math.max(0, stats.participants - (stats.showcase ?? 0));
  const tz = event?.timezone ?? 'Asia/Kolkata';
  const phase = event?.phase;
  const canInvalidate = phase === 'voting' || phase === 'closed';
  // Who voted for whom: every valid ballot's picks, grouped by project.
  const byProject = new Map<string, {title: string; voters: string[]}>();
  for (const b of ballots) {
    if (b.status !== 'valid') continue;
    for (const pick of b.ballot_selections ?? []) {
      const entry = byProject.get(pick.submission_id) ?? {title: pick.submissions?.title ?? 'Project', voters: []};
      entry.voters.push(b.participants?.display_name ?? 'Participant');
      byProject.set(pick.submission_id, entry);
    }
  }
  const tally = [...byProject.values()].sort((a, b) => b.voters.length - a.voters.length || a.title.localeCompare(b.title));
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="organizer desk" title="Voting operations">
        <p>You control the booth: open it, close it, reopen it, and see every ballot. Only organizers can see this page.</p>
      </PageHeading>
      <div className="stats-grid" data-stagger>
        <Stat icon="cup" label="valid ballots" value={<CountUp value={stats.ballots}/>}/>
        <Stat icon="people" label="turnout" value={<><CountUp value={voters ? Math.round((stats.ballots / voters) * 100) : 0}/>%</>}/>
        <Stat icon="star" label="shortlisted projects" value={<CountUp value={stats.shortlisted}/>}/>
        <Stat icon="x" label="invalidated" value={<CountUp value={stats.invalidated_ballots}/>}/>
      </div>
      <Window title="voting_window.exe" tone="yellow" icon="clock" reveal>
        <div className="phase-control">
          <div>
            <p className="eyebrow">voting booth</p>
            <h2>{phase === 'voting' ? 'Open: participants can vote now' : phase === 'closed' ? 'Closed: you can reopen it' : phase === 'shortlist_frozen' ? 'Ready to open' : phase === 'results_published' ? 'Results are published' : 'Not ready yet'}</h2>
            <p className="small muted">{stats.ballots} of {voters} competition participants have voted.{stats.showcase ? ` ${stats.showcase} showcase participants don’t vote.` : ''}</p>
            <Progress value={stats.ballots} max={voters} label="Turnout"/>
          </div>
          <div className="phase-actions">
            {phase === 'shortlist_frozen' && (
              <ConfirmAction action={adminAction} label="Open voting" title="open_voting.exe" phrase="VOTING" variant="coral"
                fields={<><input type="hidden" name="op" value="phase"/><input type="hidden" name="target" value="voting"/></>}>
                <p>Participants can submit one ballot of three shortlisted projects right away. It stays open until you close it.</p>
              </ConfirmAction>
            )}
            {phase === 'voting' && (
              <ConfirmAction action={adminAction} label="Close voting now" title="close_voting.exe" phrase="CLOSED" variant="danger"
                fields={<><input type="hidden" name="op" value="phase"/><input type="hidden" name="target" value="closed"/></>}>
                <p>No further ballots will be accepted until you reopen voting.</p>
              </ConfirmAction>
            )}
            {phase === 'closed' && (
              <ConfirmAction action={adminAction} label="Reopen voting" title="reopen_voting.exe" phrase="VOTING" variant="secondary"
                fields={<><input type="hidden" name="op" value="phase"/><input type="hidden" name="target" value="voting"/></>}>
                <p>The booth opens again for everyone who hasn’t voted yet. Existing ballots stay as they are.</p>
              </ConfirmAction>
            )}
            {!['shortlist_frozen', 'voting', 'closed'].includes(phase ?? '') && <p className="small muted">Voting controls appear once the shortlist is frozen.</p>}
          </div>
        </div>
      </Window>
      <Window title="vote_totals.csv" tone="lime" icon="star" reveal>
        <div className="row"><h2>Vote totals</h2>{counts && <span className="muted">{totalVotes} total{totalVotes !== totalBallots ? ` (${totalBallots} from ballots)` : ''}</span>}</div>
        <p className="small muted">Set any project’s total by hand, for example after a paper recount. Every change needs a reason and goes in the audit log. Ballots cast later still add on top. Totals lock when results are published.</p>
        {counts === null ? <p className="notice">Run <code>supabase/patches/2026-10-22-tracks-and-vote-edits.sql</code> in the Supabase SQL Editor to edit totals.</p>
          : counts.length ? (
          <ul className="vote-totals" data-lenis-prevent>
            {counts.map(c => (
              <li key={c.submission_id}>
                <span className="vote-title"><strong>{c.title}</strong>{c.delta !== 0 && <small>{c.ballots} from ballots, {c.delta > 0 ? '+' : ''}{c.delta} by hand: {c.reason}</small>}</span>
                <b className="vote-total">{c.total}</b>
                {c.delta !== 0 ? <Badge tone="yellow">edited</Badge> : <span/>}
                {canEdit ? (
                  <ConfirmAction action={adminAction} label="Edit" title="edit_votes.exe" variant="small-button secondary"
                    fields={<><input type="hidden" name="op" value="votes"/><input type="hidden" name="id" value={c.submission_id}/>
                      <Field label="New vote total" name="votes" type="number" value={Number(c.total)} required/>
                      <TextArea name="reason" label="Reason (10+ characters)" maxLength={1000} rows={2} required/></>}>
                    <p><strong>{c.title}</strong> has {c.ballots} vote{Number(c.ballots) === 1 ? '' : 's'} from ballots{c.delta !== 0 ? ` and shows ${c.total} after an earlier edit` : ''}. Set the total everyone will see. Setting it back to {c.ballots} removes the edit.</p>
                  </ConfirmAction>
                ) : <span/>}
              </li>
            ))}
          </ul>
        ) : <Empty title="No shortlisted projects yet."/>}
      </Window>
      <Window title="ballot_ledger.log" icon="receipt" reveal>
        <p className="small muted">Invalidate only under a documented integrity rule, never because someone voted for a friend. Invalidated ballots stay in the record and cannot be replaced.</p>
        {ballots.length ? (
          <ul className="ledger" data-lenis-prevent>
            {ballots.map(b => (
              <li key={b.id} className={'ledger-row ' + b.status}>
                <code>{b.id.slice(0, 8)}</code>
                <span className="ledger-who"><strong>{b.participants?.display_name}</strong><small>{b.participants?.email} · {formatDate(b.submitted_at, tz)}</small></span>
                <span className="ledger-picks">{(b.ballot_selections ?? []).map(p => <span key={p.submission_id} className="chip-pick">{p.submissions?.title}</span>)}</span>
                <Badge status={b.status}/>
                {b.status === 'invalidated' ? <small className="ledger-reason">{b.invalidated_reason}</small> : canInvalidate && (
                  <ConfirmAction action={adminAction} label="Invalidate" title="invalidate_ballot.exe" phrase="INVALIDATE" variant="small-button danger"
                    fields={<><input type="hidden" name="op" value="invalidate"/><input type="hidden" name="id" value={b.id}/>
                      <TextArea name="reason" label="Rule and evidence (20+ characters)" maxLength={1000} rows={3} required/></>}>
                    <p>Invalidating {b.participants?.display_name}’s ballot removes its three points. The participant cannot vote again. This is permanent and logged.</p>
                  </ConfirmAction>
                )}
              </li>
            ))}
          </ul>
        ) : <Empty title="No ballots yet."/>}
      </Window>
      <Window title="votes_by_project.csv" icon="trophy" reveal>
        <h2>Who voted for each project</h2>
        <p className="small muted">Valid ballots only. Invalidated ballots are left out.</p>
        {tally.length ? (
          <ul className="who-voted" data-lenis-prevent>
            {tally.map(t => (
              <li key={t.title}>
                <span className="who-title"><strong>{t.title}</strong><b>{t.voters.length} vote{t.voters.length === 1 ? '' : 's'}</b></span>
                <span className="who-names">{t.voters.join(', ')}</span>
              </li>
            ))}
          </ul>
        ) : <Empty title="No votes yet."/>}
      </Window>
    </div>
  );
}
