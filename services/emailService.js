import { config } from '../config/env.js';

/**
 * Sends a university email verification email.
 * In development the token is printed to the console so manual testing
 * does not require an SMTP server.  Swap the body of `sendEmail` for a
 * real transporter (e.g. Nodemailer + SendGrid/Brevo) before deploying.
 *
 * @param {string} to      - Recipient university email address
 * @param {string} token   - Signed verification token
 */
export async function sendVerificationEmail(to, token) {
  const verifyUrl = `${config.clientUrl}/verify-email?token=${token}`;

  const emailPayload = {
    to,
    subject: 'CampusHustle — Verify your university email',
    text: `Welcome to CampusHustle!\n\nClick the link below (or paste it into your browser) to verify your university email address.\nThis link expires in 24 hours.\n\n${verifyUrl}\n\nIf you did not create a CampusHustle account, you can safely ignore this email.`
  };

  await sendEmail(emailPayload);
}

/**
 * Sends a generic email.
 * Replace the `if (config.nodeEnv === 'production')` branch with a real
 * transporter once SMTP credentials are available.
 *
 * @param {{ to: string, subject: string, text: string }} options
 */
async function sendEmail({ to, subject, text }) {
  if (config.nodeEnv === 'production') {
    // TODO: plug in real transporter here (e.g. Nodemailer + SMTP_HOST, SMTP_USER, SMTP_PASS env vars)
    // Example:
    //   const transporter = nodemailer.createTransport({ host: config.smtpHost, ... });
    //   await transporter.sendMail({ from: config.emailFrom, to, subject, text });
    throw new Error('Production email transport is not configured yet.');
  }

  // Development: print the email payload to the console so developers can
  // copy the verification token without needing an inbox.
  console.log('\n───── [EmailService] Dev mode — email NOT sent ─────');
  console.log(`  To:      ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body:\n${text}`);
  console.log('────────────────────────────────────────────────────\n');
}
