import { Router, Request, Response } from 'express';
import { PushSubscription } from '../models/PushSubscription.js';
import { sendPushNotification } from '../lib/push.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/**
 * GET /api/cron/reminders
 * Triggered hourly by Vercel Cron or external scheduler
 */
router.get('/reminders', async (req: Request, res: Response) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;

    // Secure endpoint when CRON_SECRET is configured in production
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return sendError(res, 'Unauthorized cron invocation', 401);
    }

    const subscriptions = await PushSubscription.find({});
    let sentCount = 0;

    const now = new Date();

    for (const sub of subscriptions) {
      try {
        const tz = sub.timezone || 'UTC';

        // Calculate user's current local hour and local date string
        const hourFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          hour12: false,
        });
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });

        const localHour = parseInt(hourFormatter.format(now), 10);
        const localDate = dateFormatter.format(now);

        // Prevent duplicate alerts on the same calendar day for this user
        if (sub.lastNotifiedDate === localDate) {
          continue;
        }

        // 1. Morning Habit Alert (8:00 AM - 9:59 AM)
        if (localHour >= 8 && localHour <= 9 && sub.preferences?.dailyReminders) {
          const sent = await sendPushNotification(sub, {
            title: 'Your Daily Cadence is Ready 🎯',
            body: 'Focus your day with your scheduled habits and tasks.',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: `cadence-morning-${localDate}`,
            data: { url: '/habits' },
          });

          if (sent) {
            sentCount++;
            sub.lastNotifiedDate = localDate;
            await sub.save();
          }
        }
        // 2. Evening Digest & Streak Protection (8:00 PM - 9:59 PM)
        else if (localHour >= 20 && localHour <= 21 && sub.preferences?.dailyCadenceDigest) {
          const sent = await sendPushNotification(sub, {
            title: 'Evening Cadence Review ⏳',
            body: 'Review your checklist before midnight rollover to protect your streak!',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: `cadence-evening-${localDate}`,
            data: { url: '/' },
          });

          if (sent) {
            sentCount++;
            sub.lastNotifiedDate = localDate;
            await sub.save();
          }
        }
      } catch (err) {
        console.warn(`[Cron] Error evaluating subscription ${sub._id}:`, err);
      }
    }

    return sendSuccess(
      res,
      {
        totalSubscribers: subscriptions.length,
        dispatchedAlerts: sentCount,
        timestamp: now.toISOString(),
      },
      'Cron reminder cycle complete'
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Cron] Reminder scheduler encountered error:', err);
    return sendError(res, err?.message || 'Cron execution failed', 500);
  }
});

export default router;
