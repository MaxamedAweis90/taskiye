import { Router, Response } from 'express';
import { PushSubscription } from '../models/PushSubscription.js';
import { InAppNotification } from '../models/InAppNotification.js';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import {
  dispatchUnifiedNotification,
  getVapidPublicKey,
  configureWebPush,
} from '../lib/push.js';

const router = Router();

// Initialize VAPID
configureWebPush();

/**
 * GET /api/notifications
 * Retrieves unread count and latest 30 in-app notifications
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const userId = req.user?.id || null;
    const endpoint = (req.query.endpoint as string | undefined) || null;

    if (!userId && !endpoint) {
      return sendSuccess(res, { notifications: [], unreadCount: 0 });
    }

    const filter = userId
      ? { $or: [{ userId }, ...(endpoint ? [{ endpoint }] : [])] }
      : { endpoint };

    const [notifications, unreadCount] = await Promise.all([
      InAppNotification.find(filter).sort({ createdAt: -1 }).limit(30),
      InAppNotification.countDocuments({ ...filter, isRead: false }),
    ]);

    return sendSuccess(res, { notifications, unreadCount });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Notifications] Fetch failed:', err);
    return sendError(res, err?.message || 'Failed to fetch notifications', 500);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read
 */
router.patch('/:id/read', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await InAppNotification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );
    if (!updated) {
      return sendError(res, 'Notification not found', 404);
    }
    return sendSuccess(res, updated, 'Notification marked as read');
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to update notification', 500);
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Marks all notifications for user or endpoint as read
 */
router.post('/mark-all-read', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const endpoint = (req.body.endpoint as string | undefined) || null;

    if (!userId && !endpoint) {
      return sendSuccess(res, { modifiedCount: 0 });
    }

    const filter = userId
      ? { $or: [{ userId }, ...(endpoint ? [{ endpoint }] : [])], isRead: false }
      : { endpoint, isRead: false };

    const result = await InAppNotification.updateMany(filter, { isRead: true });
    return sendSuccess(res, { modifiedCount: result.modifiedCount }, 'All notifications marked as read');
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to mark all as read', 500);
  }
});

/**
 * DELETE /api/notifications/:id
 * Removes a notification item
 */
router.delete('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await InAppNotification.findByIdAndDelete(id);
    return sendSuccess(res, null, 'Notification removed');
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to delete notification', 500);
  }
});

/**
 * GET /api/notifications/preferences
 * Retrieves saved user notification preferences from the database
 */
router.get('/preferences', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const userId = req.user?.id || null;
    const endpoint = (req.query.endpoint as string | undefined) || null;

    if (!userId && !endpoint) {
      return sendSuccess(res, { preferences: null });
    }

    const filter = userId
      ? { $or: [{ userId }, ...(endpoint ? [{ endpoint }] : [])] }
      : { endpoint };

    const sub = await PushSubscription.findOne(filter).sort({ updatedAt: -1 });
    return sendSuccess(res, { preferences: sub?.preferences || null });
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to fetch preferences', 500);
  }
});

/**
 * POST /api/notifications/preferences
 * Updates user notification preferences in the database
 */
router.post('/preferences', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const { preferences, endpoint } = req.body || {};

    const safePrefs = {
      dailyReminders: preferences?.dailyReminders ?? true,
      morningReminderTime: preferences?.morningReminderTime || '08:00',
      taskPlanningReminder: preferences?.taskPlanningReminder ?? true,
      taskPlanningTime: preferences?.taskPlanningTime || '09:00',
      streakAlerts: preferences?.streakAlerts ?? true,
      dailyCadenceDigest: preferences?.dailyCadenceDigest ?? true,
      completionChimes: preferences?.completionChimes ?? true,
    };

    if (userId || endpoint) {
      const filter = userId
        ? { $or: [{ userId }, ...(endpoint ? [{ endpoint }] : [])] }
        : { endpoint };

      await PushSubscription.updateMany(filter, {
        $set: { preferences: safePrefs },
      });
    }

    return sendSuccess(res, { preferences: safePrefs }, 'Preferences updated successfully');
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to update preferences', 500);
  }
});

/**
 * GET /api/notifications/vapid-public-key
 * Returns the public key required for the browser to subscribe via PushManager
 */
router.get('/vapid-public-key', (_req, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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
      morningReminderTime: preferences?.morningReminderTime || '08:00',
      taskPlanningReminder: preferences?.taskPlanningReminder ?? true,
      taskPlanningTime: preferences?.taskPlanningTime || '09:00',
      streakAlerts: preferences?.streakAlerts ?? true,
      dailyCadenceDigest: preferences?.dailyCadenceDigest ?? true,
      completionChimes: preferences?.completionChimes ?? true,
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
 * Sends an immediate test notification to the requester's device and stores in-app notification
 */
router.post('/test', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpoint } = req.body || {};
    const userId = req.user?.id || null;

    let sub = endpoint ? await PushSubscription.findOne({ endpoint }) : null;
    if (!sub && userId) {
      sub = await PushSubscription.findOne({ userId }).sort({ updatedAt: -1 });
    }

    const result = await dispatchUnifiedNotification({
      sub,
      userId,
      endpoint: endpoint || sub?.endpoint || null,
      title: 'Taskiye Connected! 🔥',
      body: 'Your device is verified and ready for daily task planning & streak alerts.',
      type: 'system',
      tag: 'taskiye-test-notification',
      url: '/',
    });

    return sendSuccess(
      res,
      { dispatched: result.pushSent, inAppSaved: result.inAppSaved },
      'Test notification processed'
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Notifications] Test alert failed:', err);
    return sendError(res, err?.message || 'Failed to send test alert', 500);
  }
});

export default router;
