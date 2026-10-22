import {route} from '@/lib/api';
import {getVotingStatus} from '@/lib/portal';
export const GET = route({role: 'participant'}, async ({s}) => getVotingStatus(s));
