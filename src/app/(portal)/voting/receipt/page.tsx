import Link from 'next/link';
import {formatDate, getEvent, getReceipt, requireRole} from '@/lib/portal';
import {Empty, PageHeading} from '@/components/ui';

export const metadata = {title: 'Ballot receipt'};

export default async function Receipt() {
  const s = await requireRole('participant', '/voting/receipt');
  const [event, receipt] = await Promise.all([getEvent(), getReceipt(s)]);
  const tz = event?.timezone ?? 'Asia/Kolkata';
  return (
    <div className="stack-lg">
      <PageHeading eyebrow="proof of vote" title="Your ballot receipt"/>
      {receipt ? (
        <div className="receipt-wrap">
          <article className="receipt" data-reveal aria-label="Ballot receipt">
            <header>
              <img src="/assets/logo.png" alt="Boba Bash" width="120" height="78"/>
              <p>{event?.name ?? 'Boba Bash'} · official ballot</p>
            </header>
            <dl>
              <dt>ballot no.</dt><dd>{receipt.ballot_id.slice(0, 8).toUpperCase()}</dd>
              <dt>recorded</dt><dd>{formatDate(receipt.submitted_at, tz)}</dd>
              <dt>status</dt><dd className={receipt.status === 'valid' ? 'ok' : 'bad'}>{receipt.status === 'valid' ? '✓ valid' : 'invalidated'}</dd>
            </dl>
            <ol>
              {receipt.selections.map(p => <li key={p.id}><span>{p.title}</span><b>1 pt</b></li>)}
            </ol>
            <p className="receipt-total"><span>total</span><b>{receipt.selections.length} pts</b></p>
            <footer>thank you for voting ♡<br/>totals stay secret until results are published</footer>
          </article>
          {receipt.status === 'invalidated' && <p className="notice error-notice">An organizer invalidated this ballot under a documented integrity rule. Please talk to an organizer if you have questions.</p>}
        </div>
      ) : (
        <Empty title="No ballot recorded yet." art="step-boba">
          <p>Once you submit your three picks, your receipt appears here.</p>
          <Link className="button" href="/voting">Go to the voting booth →</Link>
        </Empty>
      )}
    </div>
  );
}
