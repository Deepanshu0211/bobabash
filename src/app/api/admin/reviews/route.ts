import {route} from '@/lib/api';
import {getTally, listAllAssignments} from '@/lib/portal';
export const GET = route({role: 'organizer'}, async ({s}) => ({tally: await getTally(s), assignments: await listAllAssignments(s)}));
