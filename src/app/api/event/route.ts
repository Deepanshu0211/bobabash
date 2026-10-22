import {route} from '@/lib/api';
import {getEvent} from '@/lib/portal';
export const GET = route({}, async () => getEvent());
