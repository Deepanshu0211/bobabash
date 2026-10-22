import {route} from '@/lib/api';
import {getEvent, getOverview} from '@/lib/portal';
export const GET = route({role: 'organizer'}, async ({s}) => ({event: await getEvent(), stats: await getOverview(s)}));
