import {route} from '@/lib/api';
import {listAudit} from '@/lib/portal';
export const GET = route({role: 'organizer'}, async ({s, req}) => listAudit(s, Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1)));
