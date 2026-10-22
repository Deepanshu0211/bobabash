import {route} from '@/lib/api';
import {PortalError} from '@/lib/errors';
import {getMyAssignment} from '@/lib/portal';
import {idSchema} from '@/lib/validation';
export const GET = route<{id: string}>({role: 'reviewer'}, async ({s, params}) => {
  const assignment = await getMyAssignment(s, idSchema.parse(params.id));
  if (!assignment) throw new PortalError(404, 'Assignment not found.');
  return assignment;
});
