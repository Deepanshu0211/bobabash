import {NextResponse} from 'next/server';
import {emailCodeOn, mailConfigured} from '@/lib/mail';
import {directEntryConfigured} from '@/lib/supabase/admin';

// Yes/no only, never values: lets organizers see which sign-in settings the deployed site picked up.
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json({
    participant_email_code: emailCodeOn,
    code_mailer_configured: mailConfigured,
    direct_entry_configured: directEntryConfigured,
    team_code_configured: Boolean(process.env.ORGANIZER_ACCESS_CODE?.trim())
  }, {headers: {'Cache-Control': 'no-store'}});
}
