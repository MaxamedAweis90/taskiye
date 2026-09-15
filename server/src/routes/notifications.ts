import { Router, Response } from 'express';
import { PushSubscription } from '../models/PushSubscription.js';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { sendPushNotification, getVapidPublicKey, configureWebPush } from '../lib/push.js';

const router = Router();

// Initialize VAPID
configureWebPush();

/**
 * GET /api/notifications/vapid-public-key
 * Returns the public key required for the browser to subscribe via PushManager
 */
router.get('/vapid-public-key', (_req, res: Response) => {
  return sendSuccess(res, { publicKey: getVapidPublicKey() });
});

/**
 * POST /api/notifications/subscribe
 * Registers or updates a device push subscription
 */
router.post('/subscribe', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpoint, keys, timezone, preferences } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return sendError(res, 'Invalid subscription payload: endpoint and keys are required', 400);
    }

    const userId = req.user?.id || null;
    const safeTimezone = timezone || 'UTC';
    const safePrefs = {
      dailyReminders: preferences?.dailyReminders ?? true,
      streakAlerts: preferences?.streakAlerts ?? true,
      dailyCadenceDigest: preferences?.dailyCadenceDigest ?? true,
    };

    const updatedSub = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId,
        endpoint,
        keys,
        timezone: safeTimezone,
        preferences: safePrefs,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, updatedSub, 'Push subscription registered successfully');
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Notifications] Subscription registration failed:', err);
    return sendError(res, err?.message || 'Failed to save subscription', 500);
  }
});

/**
 * POST /api/notifications/unsubscribe
 * Removes an existing device subscription
 */
router.post('/unsubscribe', async (req, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return sendError(res, 'Endpoint is required to unsubscribe', 400);
    }

    await PushSubscription.deleteOne({ endpoint });
    return sendSuccess(res, null, 'Unsubscribed successfully');
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Notifications] Unsubscribe failed:', err);
    return sendError(res, err?.message || 'Failed to unsubscribe', 500);
  }
});

/**
 * POST /api/notifications/test
 * Sends an immediate test notification to the requester's device
 */
router.post('/test', async (req, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return sendError(res, 'Endpoint is required to send a test notification', 400);
    }

    const sub = await PushSubscription.findOne({ endpoint });
    if (!sub) {
      return sendError(res, 'No active subscription found for this device', 404);
    }

    const dispatched = await sendPushNotification(sub, {
      title: 'Taskiye Connected! 🔥',
      body: 'Your device is verified and ready for streak & daily habit alerts.',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'taskiye-test-notification',
      data: {
        url: '/',
        type: 'test',
      },
    });

    if (dispatched) {
      return sendSuccess(res, { dispatched: true }, 'Test notification sent to device');
    } else {
      return sendError(res, 'Could not deliver notification. Check device permissions.', 502);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Notifications] Test alert failed:', err);
    return sendError(res, err?.message || 'Failed to send test alert', 500);
  }
});

export default router;
