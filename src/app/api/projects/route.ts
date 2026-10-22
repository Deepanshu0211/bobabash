import {route} from '@/lib/api';
import {listProjects} from '@/lib/portal';
export const GET = route({}, async ({s, req}) => {
  const q = req.nextUrl.searchParams;
  return listProjects(s, {search: q.get('q') ?? '', page: Math.max(1, Number(q.get('page')) || 1)});
});
