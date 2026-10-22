import Link from 'next/link';
import {getEvent, getMySubmission, getOverview, getVotingStatus, listMyAssignments, requireSession, formatEventDay} from '@/lib/portal';
import {PHASES, phaseIndex} from '@/lib/rules.mjs';
import {Badge, Pearls, Progress, Window} from '@/components/ui';
import {PhaseTimeline} from '@/components/phase';
import {CountUp} from '@/components/motion';
import {Icon} from '@/components/icons';

export const metadata = {title: 'Dashboard'};

export default async function Dashboard() {
  const s = await requireSession();
  const event = await getEvent();
  const is = (r: string) => s.roles.includes(r as never);
  const [submission, voting, assignments, overview] = await Promise.all([
    is('participant') ? getMySubmission(s) : null,
    is('participant') ? getVotingStatus(s) : null,
    is('reviewer') ? listMyAssignments(s) : null,
    is('organizer') ? getOverview(s) : null
  ]);
  const phase = PHASES[phaseIndex(event?.phase ?? 'setup')];
  const name = s.displayName;
  const done = assignments?.filter(a => a.status === 'completed').length ?? 0;

  return (
    <div className="stack-lg">
      <section className="welcome" data-reveal>
        <div className="welcome-copy">
          <p className="eyebrow">your little corner of the bash</p>
          <h1>Hey, {name}!</h1>
          {formatEventDay(event) && <p className="welcome-day">{formatEventDay(event)}</p>}
          <p className="lede">{phase.description}</p>
        </div>
        <img className="welcome-art" src="/assets/step-boba.png" alt="" data-parallax="-0.1"/>
        <span className="welcome-bubble" aria-hidden="true">{phase.short}!</span>
      </section>

      <Window title="event_timeline.exe" tone="yellow" icon="clock" reveal>
        <PhaseTimeline phase={event?.phase ?? 'setup'}/>
      </Window>

      <div className="task-grid" data-stagger>
        {is('participant') && (
          <article className="task-card">
            <span className="task-icon"><Icon name="upload"/></span>
            <h2>My submission</h2>
            {submission ? <>
              <p className="task-title">{submission.title}</p>
              <p><Badge status={submission.status}/> {submission.shortlist_status !== 'pending' && <Badge status={submission.shortlist_status}/>}</p>
            </> : <p>No project yet. {event?.phase === 'submissions' ? 'Your idea starts here.' : 'Submissions are not open.'}</p>}
            <Link className="button" href="/submission">{submission ? 'View submission' : 'Start my project'} →</Link>
          </article>
        )}
        {is('participant') && (
          <article className="task-card tone-pink-card">
            <span className="task-icon"><Icon name="cup"/></span>
            <h2>Voting booth</h2>
            {voting?.has_ballot ? <><Pearls filled={3}/><p>Your ballot is recorded. Thank you!</p><Link className="button secondary" href="/voting/receipt">See receipt →</Link></>
              : voting?.reason === 'showcase' ? <><Pearls filled={0}/><p>You’re in the showcase: your project is on the wall for everyone to see. Voting and prizes are for the competition list.</p><Link className="button secondary" href="/projects">Browse projects →</Link></>
              : voting?.eligible ? <><Pearls filled={0}/><p>Three votes are waiting for you.</p><Link className="button coral" href="/voting">Vote now →</Link></>
                : <><Pearls filled={0}/><p>Voting opens when organizers open it.</p><Link className="button secondary" href="/projects">Browse projects →</Link></>}
          </article>
        )}
        {is('reviewer') && assignments && (
          <article className="task-card tone-lime-card">
            <span className="task-icon"><Icon name="inbox"/></span>
            <h2>Review queue</h2>
            <p><strong><CountUp value={done}/></strong> of {assignments.length} reviews complete</p>
            <Progress value={done} max={assignments.length} label="Reviews complete"/>
            <Link className="button" href="/reviewer/queue">{done < assignments.length ? 'Continue reviewing' : 'Open queue'} →</Link>
          </article>
        )}
        {is('organizer') && overview && (
          <article className="task-card tone-yellow-card">
            <span className="task-icon"><Icon name="gauge"/></span>
            <h2>Organizer desk</h2>
            <dl className="mini-stats">
              <div><dt>signed in</dt><dd><CountUp value={overview.linked}/>/{overview.participants}</dd></div>
              <div><dt>reviews</dt><dd><CountUp value={overview.completed_reviews}/>/{overview.assignments}</dd></div>
              <div><dt>ballots</dt><dd><CountUp value={overview.ballots}/></dd></div>
            </dl>
            {event?.phase === 'setup' && <p className="notice">Submissions are closed until you open them.</p>}
            <Link className="button" href="/admin/overview">{event?.phase === 'setup' ? 'Open submissions →' : 'Open overview →'}</Link>
          </article>
        )}
        <article className="task-card">
          <span className="task-icon"><Icon name="trophy"/></span>
          <h2>Results</h2>
          <p>{event?.phase === 'results_published' ? 'The results are in. Go see the winners!' : 'The leaderboard stays hidden until organizers publish verified results.'}</p>
          <Link className="button secondary" href="/results">{event?.phase === 'results_published' ? 'See results' : 'Peek at the rules'} →</Link>
        </article>
      </div>
    </div>
  );
}
