import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '../.env' });

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function getMailTransporter() {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  if (!gmailUser || !gmailPass) {
    return null;
  }

  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
}

export async function sendEmail({ to, subject, html, text }: EmailPayload): Promise<{ success: boolean; delivered: boolean }> {
  const transporter = getMailTransporter();
  const gmailUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || (gmailUser ? `Taskiye <${gmailUser}>` : 'Taskiye <no-reply@taskiye.com>');

  if (!transporter) {
    return { success: true, delivered: false };
  }

  try {
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html,
    });
    return { success: true, delivered: true };
  } catch (err) {
    console.error(`[Taskiye Email Error] Failed to send email to ${to}:`, err);
    return { success: false, delivered: false };
  }
}

function buildHtmlEmail(title: string, greeting: string, bodyText: string, ctaText: string, ctaUrl: string, hintText?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #070D19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0; }
    .container { max-width: 540px; margin: 40px auto; background-color: #10192D; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 36px 32px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); }
    .logo-container { text-align: center; margin-bottom: 28px; }
    .logo-text { font-size: 26px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.5px; }
    .logo-highlight { color: #FACC15; }
    .title { font-size: 20px; font-weight: 800; color: #FFFFFF; margin-bottom: 14px; text-align: center; }
    .content { font-size: 14px; line-height: 1.65; color: #94A3B8; margin-bottom: 28px; text-align: center; }
    .btn-container { text-align: center; margin-bottom: 30px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #F59E0B, #D97706); color: #070D19 !important; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 34px; border-radius: 14px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.35); text-transform: uppercase; letter-spacing: 0.5px; }
    .hint { font-size: 11.5px; color: #64748B; text-align: center; margin-bottom: 20px; word-break: break-all; }
    .footer { border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 20px; text-align: center; font-size: 11px; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <div class="logo-text">Task<span class="logo-highlight">iye</span> ⚡</div>
    </div>
    <div class="title">${title}</div>
    <div class="content">
      <p style="color: #CBD5E1; font-weight: 600; margin-bottom: 8px;">${greeting}</p>
      <p>${bodyText}</p>
    </div>
    <div class="btn-container">
      <a href="${ctaUrl}" target="_blank" class="btn">${ctaText}</a>
    </div>
    ${hintText ? `<div class="hint">${hintText}</div>` : ''}
    <div class="hint" style="margin-top: 24px;">
      Or copy and paste this link into your browser:<br />
      <a href="${ctaUrl}" style="color: #FACC15; text-decoration: none;">${ctaUrl}</a>
    </div>
    <div class="footer">
      This automated security email was sent to you by Taskiye.<br />
      If you did not request this, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendVerificationEmail(email: string, verifyUrl: string): Promise<boolean> {
  const title = 'Verify Your Email Address';
  const greeting = 'Welcome to Taskiye!';
  const bodyText = 'Please verify your email address to secure your account, protect your daily habit streaks, and access unlimited sync features.';
  const ctaText = 'Verify Email Address';
  const hintText = 'This verification link is valid for 24 hours.';

  const html = buildHtmlEmail(title, greeting, bodyText, ctaText, verifyUrl, hintText);
  const text = `Welcome to Taskiye!\n\nPlease verify your email address by opening the following link:\n${verifyUrl}\n\nThis link is valid for 24 hours.`;

  const res = await sendEmail({
    to: email,
    subject: '⚡ Verify your Taskiye email address',
    html,
    text,
  });

  return res.success;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  const title = 'Reset Your Taskiye Password';
  const greeting = 'Hello,';
  const bodyText = 'We received a request to reset the password for your Taskiye account. Click the button below to choose a new password:';
  const ctaText = 'Reset Password';
  const hintText = 'This password reset link will expire in 1 hour. If you didn’t request this, your account remains secure.';

  const html = buildHtmlEmail(title, greeting, bodyText, ctaText, resetUrl, hintText);
  const text = `Reset Your Taskiye Password\n\nWe received a request to reset your password. Open this link to set a new password:\n${resetUrl}\n\nThis link expires in 1 hour.`;

  const res = await sendEmail({
    to: email,
    subject: '🔑 Reset your Taskiye password',
    html,
    text,
  });

  return res.success;
}

export async function sendEmailChangeVerification(newEmail: string, changeUrl: string): Promise<boolean> {
  const title = 'Confirm Your New Email Address';
  const greeting = 'Security Notice';
  const bodyText = 'You recently requested to update your email address on Taskiye to this address. Click below to verify and finalize the update:';
  const ctaText = 'Confirm New Email';
  const hintText = 'This verification link will expire in 2 hours.';

  const html = buildHtmlEmail(title, greeting, bodyText, ctaText, changeUrl, hintText);
  const text = `Confirm Your New Email Address\n\nPlease confirm your new email for Taskiye by visiting:\n${changeUrl}\n\nExpires in 2 hours.`;

  const res = await sendEmail({
    to: newEmail,
    subject: '⚡ Confirm your new Taskiye email address',
    html,
    text,
  });

  return res.success;
}
