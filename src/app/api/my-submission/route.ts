import {z} from 'zod';
import {route, readBody} from '@/lib/api';
import {getMySubmission, saveSubmission} from '@/lib/portal';
import {submissionSchema} from '@/lib/validation';
export const GET = route({role: 'participant'}, async ({s}) => getMySubmission(s));
export const PUT = route({role: 'participant'}, async ({s, req}) => {
  const {submit, ...payload} = await readBody(req, submissionSchema.extend({submit: z.boolean().default(false)}));
  return {id: await saveSubmission(s, payload, submit)};
});
