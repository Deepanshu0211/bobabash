import 'server-only';
import {NextResponse, type NextRequest} from 'next/server';
import {z} from 'zod';
import {PortalError} from './errors';
import {apiSession, type Session} from './portal';
import type {Role} from './types';

type Context<P> = {s: Session; req: NextRequest; params: P};
const json = (data: unknown, status: number) => NextResponse.json(data, {status, headers: {'Cache-Control': 'private, no-store'}});

/**
 * Wraps a route handler: verifies the session and role, blocks cross-site writes,
 * and maps PortalError / validation errors to the documented HTTP statuses.
 * `role: 'any'` means any rostered role; omit for the same.
 */
export function route<P = Record<string, never>>(options: {role?: Role | 'any'; status?: number}, handler: (ctx: Context<P>) => Promise<unknown>) {
  return async (req: NextRequest, {params}: {params: Promise<P>}) => {
    try {
      if (req.method !== 'GET') {
        const origin = req.headers.get('origin');
        if (!origin || new URL(origin).host !== req.headers.get('host')) throw new PortalError(403, 'Cross-site request blocked.');
        if (!req.headers.get('content-type')?.startsWith('application/json')) throw new PortalError(400, 'Send a JSON body.');
      }
      const s = await apiSession(options.role === 'any' ? undefined : options.role);
      const data = await handler({s, req, params: await params});
      if (data instanceof Response) return data;
      return json(data ?? {ok: true}, options.status ?? 200);
    } catch (error) {
      if (error instanceof z.ZodError) return json({error: error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join(' ')}, 400);
      if (error instanceof PortalError) return json({error: error.message}, error.status);
      console.error(error);
      return json({error: 'Something went wrong. Please try again.'}, 500);
    }
  };
}

export async function readBody<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new PortalError(400, 'Send a valid JSON body.'); }
  return schema.parse(raw);
}
