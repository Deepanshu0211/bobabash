import {route, readBody} from '@/lib/api';
import {PortalError} from '@/lib/errors';
import {submitBallot} from '@/lib/portal';
import {ballotProblem} from '@/lib/rules.mjs';
import {ballotSchema, idSchema} from '@/lib/validation';
// 201 created · 400 malformed · 401 signed out · 403 not eligible / closed · 409 already voted · 422 ineligible selection
export const POST = route({role: 'participant', status: 201}, async ({s, req}) => {
  const {submission_ids} = await readBody(req, ballotSchema);
  const problem = ballotProblem(submission_ids);
  if (problem || submission_ids.some(id => !idSchema.safeParse(id).success)) throw new PortalError(400, problem ?? 'Unknown project id.');
  return {ballot_id: await submitBallot(s, submission_ids)};
});
