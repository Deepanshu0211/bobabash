import {route} from '@/lib/api';
import {PortalError} from '@/lib/errors';
import {getAwards, getDecisions, getResults} from '@/lib/portal';
export const GET = route({role: 'organizer'}, async ({s}) => {
  const results = await getResults(s);
  if (!results) throw new PortalError(403, 'Totals are available once voting has started.');
  return {results, awards: await getAwards(s), decisions: await getDecisions(s)};
});
