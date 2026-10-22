import {route} from '@/lib/api';
import {getEvent} from '@/lib/portal';
export const GET = route({}, async ({s}) => ({user_id: s.userId, email: s.email, roles: s.roles, participant: s.participant && {id: s.participant.id, display_name: s.participant.display_name}, event: await getEvent()}));
