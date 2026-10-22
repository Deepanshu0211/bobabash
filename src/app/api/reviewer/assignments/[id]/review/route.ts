import {route, readBody} from '@/lib/api';
import {submitReview} from '@/lib/portal';
import {idSchema, reviewSchema} from '@/lib/validation';
export const PUT = route<{id: string}>({role: 'reviewer'}, async ({s, req, params}) => {
  const body = await readBody(req, reviewSchema);
  await submitReview(s, idSchema.parse(params.id), body.recommendation, body.criteria, body.note);
  return {ok: true};
});
