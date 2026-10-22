import {route} from '@/lib/api';
import {listProjects} from '@/lib/portal';
export const GET = route({role: 'participant'}, async ({s}) => (await listProjects(s, {shortlistedOnly: true, size: 100})).projects);
