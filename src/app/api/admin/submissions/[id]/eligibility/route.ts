import {route, readBody} from '@/lib/api';
import {admin} from '@/lib/portal';
import {eligibilitySchema, idSchema} from '@/lib/validation';
export const PUT = route<{id: string}>({role: 'organizer'}, async ({s, req, params}) => {
  const body = await readBody(req, eligibilitySchema);
  await admin.setEligibility(s, idSchema.parse(params.id), body.eligible, body.reason);
  return {ok: true};
});
