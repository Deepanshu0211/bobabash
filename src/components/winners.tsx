import Link from 'next/link';
import {Cover} from './ui';
import {PRIZE_NAMES} from './project-card';
import type {Highlight} from '@/lib/portal';

const PLACE = {1: '1st place', 2: '2nd place', 3: '3rd place'} as const;
const TEASER_ART = {1: 'step-boba', 2: 'step-build', 3: 'step-signup'} as const;

/** Landing-page winners in the same paper-card style as the steps: a teaser until results are published. */
export function Winners({highlights, published}: {highlights: Highlight[]; published: boolean}) {
  const places = highlights.filter(h => h.kind === 'place').sort((a, b) => (a.place ?? 9) - (b.place ?? 9));
  const awards = highlights.filter(h => h.kind !== 'place');
  const prizeKinds = Object.keys(PRIZE_NAMES) as (keyof typeof PRIZE_NAMES)[];
  return (
    <section className={'winners-section' + (published ? ' is-live' : '')} id="winners" aria-labelledby="winners-title">
      <div className="content">
        <h2 className="speech-heading" id="winners-title" data-reveal>{published ? 'Meet the winners!' : 'Who takes home the boba crown?'}</h2>
        <p className="winners-sub" data-reveal>
          {published ? 'Picked by your votes and our judges. Congratulations, builders!' : 'The community vote picks the top three. Organizers judge two special awards. Revealed at the end of the bash.'}
        </p>

        <ol className="winner-podium" data-stagger>
          {(published && places.length ? places : [1, 2, 3].map(n => ({place: n}) as Highlight)).map(w => {
            const place = (w.place ?? 1) as 1 | 2 | 3;
            const real = published && 'title' in w && w.title;
            return (
              <li key={place + (real ? w.submission_id : '')} className={'winner-card place-' + place + (real ? '' : ' teaser')}>
                <span className="winner-medal"><b>{place}</b>{PLACE[place]}</span>
                <div className="winner-art">
                  {real ? <Cover id={w.submission_id} title={w.title}/> : <><img src={`/assets/${TEASER_ART[place]}.png`} alt=""/><span className="mystery" aria-hidden="true">?</span></>}
                </div>
                <h3>{real ? w.title : 'a mystery project'}</h3>
                <p>{real ? (w.creator_name ? `by ${w.creator_name}` : '') : 'could be yours'}</p>
              </li>
            );
          })}
        </ol>

        <div className="winner-awards" data-stagger>
          {prizeKinds.map(kind => {
            const won = awards.find(a => a.kind === kind);
            if (published && !won) return null;
            return (
              <article key={kind} className={'prize-card prize-' + kind}>
                <span className="prize-badge" aria-hidden="true">✦</span>
                <div>
                  <p className="eyebrow">{PRIZE_NAMES[kind]}</p>
                  <h3>{won ? won.title : kind === 'creative' ? 'The most delightful idea' : 'The best-kept repository'}</h3>
                  <p className="muted">{won ? (won.creator_name ? `by ${won.creator_name}` : 'judged by the organizers') : 'judged by the organizers'}</p>
                </div>
              </article>
            );
          })}
        </div>

        {published && <p className="center"><Link className="button coral" href="/login">See the full results →</Link></p>}
      </div>
    </section>
  );
}
