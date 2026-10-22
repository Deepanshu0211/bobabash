import {route} from '@/lib/api';
import {PortalError} from '@/lib/errors';
import {getReceipt} from '@/lib/portal';
export const GET = route({role: 'participant'}, async ({s}) => {
  const receipt = await getReceipt(s);
  if (!receipt) throw new PortalError(404, 'No ballot recorded yet.');
  return receipt;
});
