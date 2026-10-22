import Link from 'next/link';
import {getEvent, getOverview, requireRole, formatDate} from '@/lib/portal';
import {PHASES, PHASE_MOVES, phaseIndex, isoToZoned} from '@/lib/rules.mjs';
import {adminAction} from '@/app/actions';
import {ActionForm, ConfirmAction, Field, TextArea} from '@/components/form';
import {PageHeading, Progress, Stat, Window} from '@/components/ui';
import {PhaseTimeline} from '@/components/phase';
import {CountUp} from '@/components/motion';
import {ScheduleHelper} from '@/components/schedule-helper';

export const metadata = {title: 'Organizer overview'};

const moveCopy: Record<string, string> = {
  submissions: 'Opens submissions for every rostered participant. They stay open until you move to review.',
  review: 'Closes the submission window early (if needed) and starts volunteer review. Check eligibility and assign reviewers next.',
  voting: 'Opens the ballot box for the frozen shortlist right now. It stays open until you close voting. The shortlist can no longer change except by logged emergency correction.',
  closed: 'Closes voting immediately. No more ballots can be submitted.'
};
const special: Record<string, {href: string; label: string}> = {
  review: {href: '/admin/shortlist', label: 'Finalize the shortlist →'},
  closed: {href: '/admin/results', label: 'Verify & publish results →'}
};

export default async function Overview() {
  const s = await requireRole('organizer', '/admin/overview');
  const [event, stats] = await Promise.all([getEvent(), getOverview(s)]);
  const phase = event?.phase ?? 'setup';
  const target = PHASE_MOVES[phase as keyof typeof PHASE_MOVES];
  const tz = event?.timezone ?? 'Asia/Kolkata';
  const sub = stats.submissions;
  const submitted = (sub.submitted ?? 0) + (sub.eligible ?? 0) + (sub.ineligible ?? 0);
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="organizers only" title="Behind the bash." art="step-boba">
        <p>Run the event phase by phase. Every privileged change is checked by the database and written to the audit log.</p>
      </PageHeading>

      <div className="stats-grid" data-stagger>
        <Stat icon="people" label="participants signed in" value={<><CountUp value={stats.linked}/><small>/{stats.participants}</small></>}/>
        <Stat icon="upload" label="projects submitted" value={<CountUp value={submitted}/>} hint={`${sub.draft ?? 0} drafts · ${sub.withdrawn ?? 0} withdrawn`}/>
        <Stat icon="check" label="reviews complete" value={<><CountUp value={stats.completed_reviews}/><small>/{stats.assignments}</small></>} hint={`${stats.reviewers} volunteers`}/>
        <Stat icon="cup" label="valid ballots" value={<CountUp value={stats.ballots}/>} hint={`${stats.shortlisted} shortlisted · ${stats.invalidated_ballots} invalidated`}/>
      </div>

      <Window title="phase_control.exe" tone="yellow" icon="clock" reveal>
        <PhaseTimeline phase={phase}/>
        <div className="phase-control">
          <div>
            <p className="eyebrow">current phase</p>
            <h2>{PHASES[phaseIndex(phase)].label}</h2>
            <p>{PHASES[phaseIndex(phase)].description}</p>
            {phase === 'voting' && <Progress value={stats.ballots} max={stats.participants} label="Turnout"/>}
          </div>
          <div className="phase-actions">
            {target && (
              <ConfirmAction action={adminAction} label={`Move to “${PHASES[phaseIndex(target)].label}”`} title="change_phase.exe" phrase={target.toUpperCase()}
                variant="coral" fields={<><input type="hidden" name="op" value="phase"/><input type="hidden" name="target" value={target}/></>}>
                <p>{moveCopy[target]}</p>
              </ConfirmAction>
            )}
            {special[phase] && <Link className="button" href={special[phase].href}>{special[phase].label}</Link>}
            {phase === 'results_published' && <p className="small muted">Results are published. The event is complete.</p>}
          </div>
        </div>
      </Window>

      <Window title="schedule.cfg" icon="clock" reveal>
        <ActionForm action={adminAction} label="Save schedule">
          <input type="hidden" name="op" value="event"/>
          <div className="field-pair">
            <Field label="Event name" name="name" value={event?.name ?? 'Boba Bash'} required maxLength={120}/>
            <Field label="Event timezone (IANA)" name="timezone" value={tz} required hint="Every time below is in this timezone."/>
          </div>
          <div className="field-pair">
            {([['starts_at', 'Event starts'], ['ends_at', 'Event ends']] as const).map(([key, label]) => (
              <Field key={key} label={label} name={key} type="datetime-local" value={isoToZoned(event?.[key] ?? null, tz)} hint={event?.[key] ? formatDate(event[key], tz) : 'Not set'}/>
            ))}
          </div>
          <ScheduleHelper/>
          <div className="field-grid">
            {([['submission_deadline', 'Submissions close'], ['review_deadline', 'Reviews due'], ['voting_open_at', 'Voting opens'], ['voting_close_at', 'Voting closes']] as const).map(([key, label]) => (
              <Field key={key} label={label} name={key} type="datetime-local" value={isoToZoned(event?.[key] ?? null, tz)} hint={event?.[key] ? formatDate(event[key], tz) : 'Not set'}/>
            ))}
          </div>
          <div className="field-pair">
            <Field label="Venue name" name="venue_name" value={event?.venue_name ?? ''} maxLength={200}/>
            <Field label="Venue address" name="venue_address" value={event?.venue_address ?? ''} maxLength={500}/>
          </div>
          <TextArea label="Announcement on the landing page" name="announcement" value={event?.announcement ?? ''} maxLength={2000} rows={2}/>
          <label className="check"><input type="checkbox" name="show_creator_names" defaultChecked={event?.show_creator_names ?? true}/> Show participant display names on the project wall and results</label>
        </ActionForm>
      </Window>
    </div>
  );
}
