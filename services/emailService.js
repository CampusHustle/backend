import { Resend } from 'resend';
import { config } from '../config/env.js';

let resendClient = null;

function getResendClient() {
  if (resendClient) return resendClient;
  if (config.resendApiKey) {
    resendClient = new Resend(config.resendApiKey);
  }
  return resendClient;
}

/**
 * Sends a university email verification email via Resend.
 *
 * @param {string} to      - Recipient university email address
 * @param {string} token   - Signed verification token
 */
export async function sendVerificationEmail(to, token) {
  const verifyUrl = `${config.clientUrl}/verify-email?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#1e293b;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">CampusHustle</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Verify your university email</p>
    </div>
    <div style="padding:32px 24px;text-align:center;">
      <p style="color:#cbd5e1;font-size:15px;margin:0 0 24px;">You're almost there! Click the button below to verify your university email address. This link expires in <strong style="color:#fff;">24 hours</strong>.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">Verify My Email</a>
      <p style="margin:24px 0 0;color:#64748b;font-size:11px;">Or paste this link into your browser:<br><a href="${verifyUrl}" style="color:#6366f1;word-break:break-all;">${verifyUrl}</a></p>
      <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
      <p style="color:#475569;font-size:11px;margin:0;">If you didn't create a CampusHustle account, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`;

  const client = getResendClient();

  if (!client) {
    // Fallback: log to console (dev mode or missing key)
    console.log('\n───── [EmailService] Verification Link (RESEND_API_KEY not set) ─────');
    console.log(`  To: ${to}`);
    console.log(`  Link: ${verifyUrl}`);
    console.log('─────────────────────────────────────────────────────────────────\n');
    return;
  }

  try {
    const { data, error } = await client.emails.send({
      from: config.emailFrom,
      to,
      subject: 'CampusHustle — Verify your university email',
      html,
      text: `Welcome to CampusHustle!\n\nVerify your university email here (expires in 24h):\n\n${verifyUrl}\n\nIf you did not create a CampusHustle account, you can safely ignore this email.`,
    });

    if (error) {
      console.error(`[EmailService] Resend error sending to ${to}:`, error.message);
    } else {
      console.log(`[EmailService] ✅ Verification email sent to ${to} (id: ${data?.id})`);
    }
  } catch (err) {
    console.error(`[EmailService] Failed to send to ${to}:`, err.message);
    // Log link as fallback
    console.log(`[EmailService] Fallback link: ${verifyUrl}`);
  }
}


