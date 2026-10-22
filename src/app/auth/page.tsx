import {redirect} from 'next/navigation';
import {safeNext} from '@/lib/security.mjs';

// Old links pointed at /auth; sign-in now lives at /login.
export default async function LegacyAuth({searchParams}: {searchParams: Promise<Record<string, string | undefined>>}) {
  const p = await searchParams;
  redirect('/login' + (p.next ? '?next=' + encodeURIComponent(safeNext(p.next)) : ''));
}
