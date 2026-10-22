import {route, readBody} from '@/lib/api';
import {admin} from '@/lib/portal';
import {phaseSchema} from '@/lib/validation';
export const POST = route({role: 'organizer'}, async ({s, req}) => {
  await admin.setPhase(s, (await readBody(req, phaseSchema)).phase);
  return {ok: true};
});
