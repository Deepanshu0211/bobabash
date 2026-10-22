import Link from 'next/link';
import {Window} from '@/components/ui';
import {PhaseTimeline} from '@/components/phase';
import {Icon} from '@/components/icons';
import {formatEventDay, getEvent} from '@/lib/portal';

export const metadata = {title: 'How it works', description: 'How Boba Bash Lucknow works: build one project, three volunteers review it, then everyone votes for three favourites. Plus the Creative and Best GitHub awards.', alternates: {canonical: '/event-rules'}};

const steps = [
  {n: '01', title: 'build', art: 'step-signup', text: 'Make one project. Submit it with a demo and a repo.'},
  {n: '02', title: 'review', art: 'step-build', text: 'Three volunteers check it. Majority decides the shortlist.'},
  {n: '03', title: 'vote', art: 'step-boba', text: 'Pick your three favourites. Then boba.'}
];

const rules = [
  {icon: 'upload', title: 'One project each', text: 'Roster members only.'},
  {icon: 'people', title: 'Three reviewers', text: 'Two yes votes = shortlisted.'},
  {icon: 'cup', title: 'Pick three', text: 'Different projects, never your own.'},
  {icon: 'lock', title: 'One final ballot', text: 'No edits after you send it.'},
  {icon: 'trophy', title: 'Hidden totals', text: 'Results appear at the end.'},
  {icon: 'star', title: 'Two judged awards', text: 'Creative and Best GitHub.'}
];

export default async function Rules() {
  const event = await getEvent();
  // The order of the day is public; the timings are announced on the day.
  const schedule = ['Doors open', 'Submissions close', 'Reviews done', 'Voting opens', 'Voting closes', 'Results'];
  return (
    <div className="rules-page">
      <section className="process-section rules-hero">
        <img className="paper-top" src="/assets/paper-top.png" alt=""/>
        <div className="content">
          <h1 className="speech-heading" data-reveal>How it works</h1>
          <p className="rules-sub" data-reveal>{formatEventDay(event) ?? 'Date to be announced'}{event?.venue_name ? ` · ${event.venue_name}` : ''}</p>
          <div className="process-grid" data-stagger>
            {steps.map(s => (
              <article className="process-card" key={s.n}>
                <span className="step-number">{s.n}</span>
                <img src={`/assets/${s.art}.png`} alt="" loading="lazy"/>
                <h2>{s.title}</h2>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </div>
        <img className="paper-bottom" src="/assets/paper-bottom.png" alt=""/>
      </section>

      <div className="content rules-body">
        <Window title="the_day.exe" tone="yellow" reveal>
          <PhaseTimeline phase={event?.phase ?? 'setup'}/>
          <ol className="run-of-show">
            {schedule.map((label, i) => <li key={label}><b>{String(i + 1).padStart(2, '0')}</b><span>{label}</span></li>)}
          </ol>
          <p className="small muted center">Exact timings are announced on the day. Organizers open each stage when everyone is ready.</p>
        </Window>

        <div className="rule-grid" data-stagger>
          {rules.map(r => (
            <article key={r.title} className="rule-card">
              <span className="task-icon"><Icon name={r.icon}/></span>
              <h2>{r.title}</h2>
              <p>{r.text}</p>
            </article>
          ))}
        </div>

        <p className="center"><Link className="button coral" href="/login">Enter the portal →</Link></p>
      </div>
    </div>
  );
}
