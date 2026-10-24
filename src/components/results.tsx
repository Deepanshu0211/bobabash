import Link from 'next/link';
import {Window} from './ui';
import {CountUp} from './motion';
import type {Award, Decision, ResultRow} from '@/lib/types';

const AWARD_NAMES = {creative: 'Creative Award', best_github: 'Best GitHub Award'} as const;

// Everyone sees rankings and winners; only organizers (showCounts) see vote numbers and bars.
export function ResultsBoard({results, awards, decisions, linkProjects = true, showCounts = false}: {results: ResultRow[]; awards: Award[]; decisions: Decision[]; linkProjects?: boolean; showCounts?: boolean}) {
  const top = Math.max(1, ...results.map(r => r.votes ?? 0));
  const podium = results.filter(r => r.standing <= 3 && (r.votes === null || r.votes > 0)).slice(0, 3);
  const tied = (r: ResultRow) => results.filter(o => o.standing === r.standing).length > 1;
  const title = (id: string) => results.find(r => r.submission_id === id)?.title ?? 'a project';
  const name = (r: ResultRow) => linkProjects ? <Link href={'/projects/' + r.submission_id}>{r.title}</Link> : r.title;
  // Podium order: 2nd, 1st, 3rd.
  const order = [podium[1], podium[0], podium[2]].filter(Boolean);
  return (
    <div className="stack-lg">
      {order.length > 0 && (
        <div className="podium" data-stagger>
          {order.map(r => (
            <div key={r.submission_id} className={'podium-step place-' + Math.min(r.standing, 3)}>
              <span className="medal">{r.standing}</span>
              <strong>{name(r)}</strong>
              {r.creator_name && <small>by {r.creator_name}</small>}
              {showCounts && r.votes !== null ? <em><CountUp value={r.votes}/> votes{tied(r) && ' · tie'}</em> : tied(r) && <em>tie</em>}
              <div className="podium-block"/>
            </div>
          ))}
        </div>
      )}

      {awards.length > 0 && (
        <div className="award-grid" data-stagger>
          {awards.map(a => (
            <article key={a.award_type} className={'award-card award-' + a.award_type}>
              <span className="award-ribbon">✦ {AWARD_NAMES[a.award_type]}</span>
              <h3>{a.submissions?.title ?? title(a.submission_id)}</h3>
              <p>{a.rationale}</p>
              <small>judged by {a.judged_by}</small>
            </article>
          ))}
        </div>
      )}

      <Window title="full_results.csv" reveal>
        <ol className="result-list">
          {results.map(r => (
            <li key={r.submission_id}>
              <span className="rank">{r.standing}{tied(r) && <i title="Tied">=</i>}</span>
              <div className="result-main">
                <strong>{name(r)}</strong>
                {r.creator_name && <small>by {r.creator_name}</small>}
                {showCounts && r.votes !== null && <div className="bar"><span style={{'--w': (r.votes / top) * 100 + '%'} as React.CSSProperties}/></div>}
              </div>
              {showCounts && r.votes !== null && <b className="votes">{r.votes}<small>votes</small></b>}
            </li>
          ))}
        </ol>
      </Window>

      {decisions.length > 0 && (
        <Window title="tie_breaks.log" tone="yellow" reveal>
          {decisions.map(d => (
            <p key={d.id} className="decision">
              <strong>Position {d.position}:</strong> {d.tied_submission_ids.map(title).join(' · ')}: {d.shared ? 'shared placement' : `awarded to ${title(d.winner_submission_id!)}`}. <em>{d.rationale}</em>
            </p>
          ))}
        </Window>
      )}
    </div>
  );
}
