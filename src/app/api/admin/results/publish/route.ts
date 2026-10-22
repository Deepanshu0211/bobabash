import {route} from '@/lib/api';
import {admin} from '@/lib/portal';
export const POST = route({role: 'organizer'}, async ({s}) => {
  await admin.publish(s);
  return {ok: true};
});
