import Link from 'next/link';
import {authenticate} from '@/app/actions';
import {ActionForm} from '@/components/form';
import {Window} from '@/components/ui';
import {requireUser} from '@/lib/data';
export default async function Reset(){await requireUser('/auth/reset-password');return <div className="auth-shell"><Window title="new_password.exe"><h1>A fresh start.</h1><ActionForm action={authenticate} label="Save new password"><input type="hidden" name="mode" value="reset"/><label>New password<input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required/></label></ActionForm><Link href="/auth">Back to sign in</Link></Window></div>;}
