import Link from 'next/link';
import {getEvent, getVotingStatus, listProjects, requireRole} from '@/lib/portal';
import {PageHeading, Window} from '@/components/ui';
import {BallotPicker, BobaCup} from '@/components/ballot';

export const metadata = {title: 'Voting booth'};

export default async function Voting() {
  const s = await requireRole('participant', '/voting');
  const [event, status] = await Promise.all([getEvent(), getVotingStatus(s)]);
  const projects = status.eligible ? (await listProjects(s, {shortlistedOnly: true, size: 100})).projects : [];

  return (
    <div className="stack-lg voting-page">
      <PageHeading eyebrow="the voting booth" title="Fill your cup with three favourites." art="drink">
        <p>Pick exactly three different shortlisted projects. One point each, one final ballot.</p>
      </PageHeading>

      {status.eligible ? (
        <BallotPicker projects={projects} max={event?.max_selections ?? 3}/>
      ) : status.reason === 'showcase' ? (
        <Window title="showcase.exe" tone="yellow" className="gate" reveal>
          <BobaCup filled={0}/>
          <div>
            <h2>You’re in the showcase.</h2>
            <p>Your project is on the wall for everyone to see. Voting and prizes are for the competition list, so there’s no ballot for you.</p>
            <Link className="button secondary" href="/projects">Browse projects →</Link>
          </div>
        </Window>
      ) : status.has_ballot ? (
        <Window title="ballot_recorded.exe" tone="lime" className="gate" reveal>
          <BobaCup filled={3}/>
          <div>
            <h2>Your ballot is in. Thank you!</h2>
            <p>Each participant submits one final ballot, so there’s nothing more to do here. Results stay hidden until organizers publish them.</p>
            <Link className="button" href="/voting/receipt">View my receipt →</Link>
          </div>
        </Window>
      ) : (
        <Window title="booth_closed.exe" tone="pink" className="gate" reveal>
          <BobaCup filled={0}/>
          <div>
            <h2>{['closed', 'results_published'].includes(event?.phase ?? '') ? 'Voting has closed.' : 'Voting hasn’t started yet.'}</h2>
            <p>Organizers open the voting booth once the shortlist is frozen.</p>
            <p className="muted small">This page updates when voting opens. Refresh if it doesn’t.</p>
            <Link className="button secondary" href="/projects">Browse projects meanwhile →</Link>
          </div>
        </Window>
      )}
    </div>
  );
}
