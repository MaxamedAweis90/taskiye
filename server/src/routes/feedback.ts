import { Router, Request, Response } from 'express';
import { sendEmail } from '../lib/email.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

type FeedbackType = 'bug' | 'ui' | 'feature' | 'account' | 'other';

const FEEDBACK_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug Report',
  ui: 'UI / Visual Problem',
  feature: 'Feature Request',
  account: 'Account Issue',
  other: 'Other',
};

const TYPE_COLORS: Record<FeedbackType, string> = {
  bug: '#ef4444',
  ui: '#f59e0b',
  feature: '#22c55e',
  account: '#3b82f6',
  other: '#8b5cf6',
};

router.post('/', async (req: Request, res: Response) => {
  const { name, email, type, message } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return sendError(res, 'Name is required.', 400);
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return sendError(res, 'A valid email address is required.', 400);
  }
  if (!type || !Object.keys(FEEDBACK_LABELS).includes(type)) {
    return sendError(res, 'Please select a feedback type.', 400);
  }
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    return sendError(res, 'Message must be at least 10 characters.', 400);
  }
  if (message.trim().length > 2000) {
    return sendError(res, 'Message must be under 2000 characters.', 400);
  }

  const recipient = process.env.FEEDBACK_RECIPIENT_EMAIL;
  if (!recipient) {
    console.error('[Feedback] FEEDBACK_RECIPIENT_EMAIL is not set in environment.');
    return sendSuccess(res, { queued: true }, 'Feedback received.');
  }

  const feedbackType = type as FeedbackType;
  const label = FEEDBACK_LABELS[feedbackType];
  const color = TYPE_COLORS[feedbackType];
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'short' });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0B132B;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:800;color:#FACC15;letter-spacing:-0.5px;">Taskiye</p>
              <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">User Feedback Submission</p>
            </td>
          </tr>
          <!-- Type badge -->
          <tr>
            <td style="padding:24px 32px 0;">
              <span style="display:inline-block;background:${color}1a;color:${color};border:1px solid ${color}40;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">${label}</span>
            </td>
          </tr>
          <!-- Sender details -->
          <tr>
            <td style="padding:20px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:12px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">From</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${name.trim()}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#64748b;">${email.trim()}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Message -->
          <tr>
            <td style="padding:20px 32px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                <p style="margin:0;font-size:14px;line-height:1.7;color:#1e293b;white-space:pre-wrap;">${message.trim()}</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">Received ${timestamp} UTC</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Taskiye Feedback — ${label}\n\nFrom: ${name.trim()} <${email.trim()}>\nType: ${label}\n\nMessage:\n${message.trim()}\n\nReceived: ${timestamp} UTC`;

  try {
    await sendEmail({
      to: recipient,
      subject: `[Taskiye Feedback] ${label} from ${name.trim()}`,
      html,
      text,
    });
  } catch (err) {
    console.error('[Feedback] Failed to send feedback email:', err);
  }

  return sendSuccess(res, {}, 'Feedback received. Thank you!');
});

export default router;
