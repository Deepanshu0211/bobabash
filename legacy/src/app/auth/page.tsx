import Link from 'next/link';
import {authenticate} from '@/app/actions';
import {ActionForm,Field} from '@/components/form';
import {Window} from '@/components/ui';
import {configured} from '@/lib/supabase/config';
import {getEvent} from '@/lib/data';
import {safeNext} from '@/lib/security.mjs';
export default async function Auth({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const p=await searchParams;const mode=p.mode==='signup'?'signup':'signin';const event=await getEvent();const closed=event&&(!event.registration_enabled||(event.registration_deadline&&Date.now()>=Date.parse(event.registration_deadline)));
 return <div className="auth-shell"><Window title="welcome_to_the_club.exe"><nav className="auth-tabs"><Link href="/auth" className={mode==='signin'?'active':''}>Sign in</Link><Link href="/auth?mode=signup" className={mode==='signup'?'active':''}>Sign up</Link></nav><h1>{mode==='signup'?'Your next idea starts here.':'Hey, welcome back.'}</h1><p>One account. A whole bunch of possibilities.</p>{p.error&&<p role="alert" className="notice error-notice">{p.error}</p>}{!configured?<p className="notice">Accounts will open once the organisers finish connecting this event. Come back soon.</p>:mode==='signup'&&closed?<p className="notice">Registration is closed for this edition. Existing builders can still sign in.</p>:<ActionForm action={authenticate} label={mode==='signup'?'Create my account →':'Sign in →'}><input name="mode" type="hidden" value={mode}/><input name="next" type="hidden" value={safeNext(p.next)}/><Field label="Email" name="email" type="email" value={p.email??''} required/><label>Password<input name="password" type="password" minLength={mode==='signup'?10:1} maxLength={128} autoComplete={mode==='signup'?'new-password':'current-password'} required/></label>{mode==='signup'&&<small>Use at least 10 characters. You may need to confirm your email.</small>}</ActionForm>}<p className="small" style={{marginTop:20}}><Link href="/auth/forgot-password">Forgot your password?</Link></p></Window></div>;
}
