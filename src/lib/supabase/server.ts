import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { credentials } from './config';
export async function serverClient() {
 const store=await cookies(); const {url,key}=credentials();
 return createServerClient(url,key,{cookies:{getAll:()=>store.getAll(),setAll(values){try{values.forEach(({name,value,options})=>store.set(name,value,options));}catch{/* Proxy refreshes cookies for server-rendered pages. */}}}});
}
