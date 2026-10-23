import 'server-only';
import nodemailer from 'nodemailer';

// Sign-in code emails, sent by the app itself through Brevo's SMTP relay so the design never
// depends on Supabase's template settings. Supabase still creates and checks the code.
const user = process.env.BREVO_SMTP_LOGIN;
const pass = process.env.BREVO_SMTP_KEY;
const from = process.env.MAIL_FROM;

export const mailConfigured = Boolean(user && pass && from);

const transport = mailConfigured
  ? nodemailer.createTransport({host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: {user, pass}})
  : null;

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!);

export async function sendSignInCode(to: string, code: string) {
  if (!transport) throw new Error('Mail is not configured.');
  await transport.sendMail({
    from: {name: 'Boba Bash', address: from!},
    to,
    subject: `Your Boba Bash sign-in code: ${code}`,
    text: `Your Boba Bash sign-in code is ${code}\n\nType it on the sign-in page. It works once and expires soon; only the newest code works.\nNever share this code. Organizers will never ask you for it.\nDidn't try to sign in? Ignore this email.`,
    html: codeEmail(escape(code))
  });
}

// Email-safe markup: tables and inline styles only, readable with images off.
function codeEmail(code: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>Your Boba Bash sign-in code</title></head>
<body style="margin:0;padding:0;background:#eaf6fb;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your code is ${code}. It works once and expires soon.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eaf6fb;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td style="padding:0 4px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#2d6479;">🧋 Boba Bash · Lucknow</td></tr>
<tr><td style="background:#fffef6;border:1px solid #9fc9d8;border-radius:6px;box-shadow:4px 4px 0 #bfe4ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background:#bfe4ee;border-bottom:1px solid #9fc9d8;border-radius:6px 6px 0 0;padding:8px 14px;font-family:'Courier New',Courier,monospace;font-size:12px;color:#24495a;">sign_in_code.exe</td>
<td align="right" style="background:#bfe4ee;border-bottom:1px solid #9fc9d8;border-radius:0 6px 0 0;padding:8px 14px;font-family:Arial,sans-serif;font-size:12px;color:#24495a;">&ndash; &#9633; <span style="display:inline-block;background:#f2a38d;color:#7a3f2f;padding:0 5px;border-radius:2px;">&times;</span></td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#24495a;">
<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#6c8890;">Event portal</p>
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#24495a;">Here’s your sign-in code</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#3d5a66;">Type this code on the Boba Bash sign-in page to enter the portal.</p>
</td></tr>
<tr><td align="center" style="padding:0 28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
<td align="center" style="background:#fff1c9;border:2px dashed #ddbe8c;border-radius:10px;padding:20px 12px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:#24495a;">${code}</td>
</tr></table></td></tr>
<tr><td style="padding:20px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:1.6;color:#3d5a66;">
<p style="margin:0 0 10px;">⏳ It works <strong>once</strong> and expires soon. Asked for a new one? Only the newest code works.</p>
<p style="margin:0 0 10px;">🔒 <strong>Never share this code.</strong> Organizers will never ask you for it.</p>
<p style="margin:0;">Didn’t try to sign in? You can ignore this email; nobody can enter without the code.</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6c8890;">Boba Bash · Chandigarh University Lucknow · a Hack Club event.<br>Stuck? Find an organizer at the help desk.</td></tr>
</table></td></tr></table>
</body></html>`;
}
