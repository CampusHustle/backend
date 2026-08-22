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
 * Sends a university email verification email.
 * Supports real SMTP via Nodemailer or dev console fallback.
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
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1329; color: #f1f5f9; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background-color: #131d38; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .brand { font-size: 22px; font-weight: 800; color: #10b981; margin-bottom: 20px; letter-spacing: -0.5px; }
    .heading { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
    .text { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; margin-bottom: 24px; text-align: center; }
    .footer { font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 20px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">🎓 CampusHustle</div>
    <div class="heading">Verify your university email address</div>
    <p class="text">Welcome to CampusHustle! To activate your account and start discovering peer tutors, selling study materials, and accessing Felat AI, please verify your email address.</p>
    <a href="${verifyUrl}" class="btn">Verify My University Email</a>
    <p class="text" style="font-size: 13px; margin-bottom: 0;">This verification link will expire in 24 hours.</p>
    <div class="footer">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${verifyUrl}" style="color: #38bdf8;">${verifyUrl}</a>
    </div>
  </div>
</body>
</html>
  `;

  const emailPayload = {
    to,
    subject: 'CampusHustle — Verify your university email',
    text: `Welcome to CampusHustle!\n\nClick the link below (or paste it into your browser) to verify your university email address.\nThis link expires in 24 hours.\n\n${verifyUrl}\n\nIf you did not create a CampusHustle account, you can safely ignore this email.`,
    html,
  };

  await sendEmail(emailPayload);
}

/**
 * Sends an email using Nodemailer when configured, or logs to console as fallback.
 *
 * @param {{ to: string, subject: string, text: string, html?: string }} options
 */
async function sendEmail({ to, subject, text, html }) {
  if (config.nodeEnv === 'test') {
    return;
  }

  const transporter = getTransporter();

  if (transporter) {
    try {
      await transporter.sendMail({
        from: config.emailFrom,
        to,
        subject,
        text,
        html: html || text,
      });
      console.log(`[EmailService] Verification email successfully sent to ${to}`);
      return;
    } catch (err) {
      console.error(`[EmailService] SMTP delivery failed to ${to}:`, err.message);
      // Fall through to console log below so user is not completely blocked
    }
  }

  // Development / fallback logging
  console.log('\n───── [EmailService] Verification Link ─────');
  console.log(`  To:      ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body:\n${text}`);
  console.log('────────────────────────────────────────────\n');
}
