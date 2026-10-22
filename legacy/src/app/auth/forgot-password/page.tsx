import Link from 'next/link';
import {authenticate} from '@/app/actions';
import {ActionForm,Field} from '@/components/form';
import {Window} from '@/components/ui';
import {configured} from '@/lib/supabase/config';
export default function Forgot(){return <div className="auth-shell"><Window title="recover_account.exe"><h1>Let&apos;s get you back in.</h1><p>We&apos;ll send a link to reset your password.</p>{configured?<ActionForm action={authenticate} label="Send recovery email"><input type="hidden" name="mode" value="forgot"/><Field name="email" label="Email" type="email" required/></ActionForm>:<p className="notice">Account recovery will be available when the event is connected.</p>}<Link href="/auth">Back to sign in</Link></Window></div>;}
