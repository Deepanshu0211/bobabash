import {route} from '@/lib/api';
import {listSubmissions} from '@/lib/portal';
const cell = (v: unknown) => {
  const text = String(v ?? '');
  // Neutralise spreadsheet formulas and quote every cell.
  return '"' + (/^[=+\-@]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
};
export const GET = route({role: 'organizer'}, async ({s, req}) => {
  const q = req.nextUrl.searchParams;
  const rows = await listSubmissions(s, {status: q.get('status') ?? '', search: q.get('q') ?? ''});
  if (q.get('format') !== 'csv') return rows;
  const header = ['id', 'title', 'participant', 'email', 'category', 'status', 'shortlist_status', 'demo_url', 'repository_url', 'submitted_at', 'eligibility_reason'];
  const body = rows.map(r => [r.id, r.title, r.participants?.display_name, r.participants?.email, r.category, r.status, r.shortlist_status, r.demo_url, r.repository_url, r.submitted_at, r.eligibility_reason].map(cell).join(','));
  return new Response([header.join(','), ...body].join('\r\n'), {headers: {'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="bobabash-submissions.csv"', 'Cache-Control': 'private, no-store'}});
});
