import {route} from '@/lib/api';
import {listMyAssignments} from '@/lib/portal';
export const GET = route({role: 'reviewer'}, async ({s}) => listMyAssignments(s));
