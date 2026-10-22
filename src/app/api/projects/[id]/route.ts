import {route} from '@/lib/api';
import {PortalError} from '@/lib/errors';
import {getProject} from '@/lib/portal';
import {idSchema} from '@/lib/validation';
export const GET = route<{id: string}>({}, async ({s, params}) => {
  const project = await getProject(s, idSchema.parse(params.id));
  if (!project) throw new PortalError(404, 'Project not found.');
  return project;
});
