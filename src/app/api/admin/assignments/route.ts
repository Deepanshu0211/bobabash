import {route, readBody} from '@/lib/api';
import {admin} from '@/lib/portal';
import {assignmentSchema} from '@/lib/validation';
export const POST = route({role: 'organizer', status: 201}, async ({s, req}) => {
  const body = await readBody(req, assignmentSchema);
  if ('auto' in body) return {created: await admin.autoAssign(s, body.per_project)};
  return {id: await admin.assign(s, body.submission_id, body.reviewer_id)};
});
