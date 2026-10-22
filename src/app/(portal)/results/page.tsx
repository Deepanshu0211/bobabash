import Link from 'next/link';
import {formatDate, getAwards, getDecisions, getEvent, getResults, requireSession} from '@/lib/portal';
import {PageHeading, Window} from '@/components/ui';
import {ResultsBoard} from '@/components/results';
import {Icon} from '@/components/icons';

export const metadata = {title: 'Results'};

export default async function Results() {
  const s = await requireSession('/results');
  const event = await getEvent();
  const published = event?.phase === 'results_published';
  const [results, awards, decisions] = published ? await Promise.all([getResults(s), getAwards(s), getDecisions(s)]) : [null, [], []];
  return (
    <div className="stack-lg">
      <PageHeading eyebrow={published ? 'the results are in' : 'still brewing'} title={published ? 'Meet the community favourites.' : 'The leaderboard is hidden.'} art={published ? 'step-boba' : undefined}>
        <p>{published ? `Verified results, published ${formatDate(event?.results_published_at, event?.timezone)}.` : 'No running totals are shown while voting is open, so early numbers never sway anyone. Check back once organizers publish verified results.'}</p>
      </PageHeading>
      {published && results ? (
        <ResultsBoard results={results} awards={awards} decisions={decisions}/>
      ) : (
        <Window title="leaderboard.lock" tone="pink" className="locked-board" reveal>
          <div className="lock-art" aria-hidden="true">
            <img src="/assets/drink.png" alt="" className="float"/>
            <span className="lock-badge"><Icon name="lock" size={22}/></span>
          </div>
          <div>
            <h2>The boba is still brewing.</h2>
            <p>Results unlock after voting closes and organizers verify every ballot, tie-break and judged award.</p>
            <Link className="button secondary" href="/event-rules">How results work →</Link>
          </div>
        </Window>
      )}
    </div>
  );
}
