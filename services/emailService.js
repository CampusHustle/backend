import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let cachedTransporter = null;

/**
 * Creates or returns the cached Nodemailer SMTP transporter.
 */
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
    return cachedTransporter;
  }

  return null;
}

/**
 * Sends an email using Brevo REST API over HTTPS (port 443).
 * This completely avoids SMTP port 587 timeouts on cloud hosting providers like Render.
 */
async function sendViaBrevoApi({ to, subject, html, text }) {
  let senderName = 'CampusHustle';
  let senderEmail = 'da16gi@gmail.com';

  if (config.emailFrom) {
    const match = config.emailFrom.match(/^(?:(.*)<)?([^>]+)>?$/);
    if (match) {
      if (match[1]?.trim()) senderName = match[1].trim();
      if (match[2]?.trim()) senderEmail = match[2].trim();
    }
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.brevoApiKey,
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Brevo HTTP error ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Sends a university email verification email.
 *
 * @param {string} to      - Recipient university email address
 * @param {string} token   - Signed verification token
 */
export async function sendVerificationEmail(to, token) {
  if (config.nodeEnv === 'test') return;

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
      <p style="color:#cbd5e1;font-size:15px;margin:0 0 24px;">You're almost there! Click the button below to verify your university email. This link expires in <strong style="color:#fff;">24 hours</strong>.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">Verify My Email</a>
      <p style="margin:24px 0 0;color:#64748b;font-size:11px;">Or paste this link into your browser:<br><a href="${verifyUrl}" style="color:#6366f1;word-break:break-all;">${verifyUrl}</a></p>
      <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
      <p style="color:#475569;font-size:11px;margin:0;">If you didn't create a CampusHustle account, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Welcome to CampusHustle!\n\nVerify your university email here (expires in 24h):\n\n${verifyUrl}\n\nIf you did not create a CampusHustle account, you can safely ignore this email.`;
  const subject = 'CampusHustle — Verify your university email';

  // 1. Try Brevo REST API over HTTPS first (immune to Render SMTP port blocking)
  if (config.brevoApiKey) {
    try {
      const data = await sendViaBrevoApi({ to, subject, html, text });
      console.log(`[EmailService] ✅ Verification email sent via Brevo REST API to ${to} (id: ${data?.messageId})`);
      return;
    } catch (err) {
      console.error(`[EmailService] Brevo REST API failed for ${to}:`, err.message);
    }
  }

  // 2. Try Nodemailer SMTP as secondary
  const transporter = getTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: config.emailFrom,
        to,
        subject,
        text,
        html,
      });
      console.log(`[EmailService] ✅ Verification email sent via SMTP to ${to} (id: ${info?.messageId})`);
      return;
    } catch (err) {
      console.error(`[EmailService] SMTP delivery failed to ${to}:`, err.message);
    }
  }

  // 3. Fallback: Log link to console if neither worked or configured
  console.log('\n───── [EmailService] Verification Link ─────');
  console.log(`  To:   ${to}`);
  console.log(`  Link: ${verifyUrl}`);
  console.log('────────────────────────────────────────────\n');
}
