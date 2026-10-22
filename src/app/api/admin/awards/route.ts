import {route, readBody} from '@/lib/api';
import {admin} from '@/lib/portal';
import {awardSchema} from '@/lib/validation';
export const POST = route({role: 'organizer', status: 201}, async ({s, req}) => {
  const a = await readBody(req, awardSchema);
  await admin.recordAward(s, a.award_type, a.submission_id, a.judged_by, a.rationale);
  return {ok: true};
});
