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

router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const userId = req.user?.id || null;
    const endpoint = (req.query.endpoint as string | undefined) || null;

    if (!userId && !endpoint) {
      return sendSuccess(res, { notifications: [], unreadCount: 0 });
    }

    const userIds: string[] = [];
    if (userId) {
      userIds.push(String(userId));
      const altId = req.user && (req.user as unknown as { _id?: string })._id;
      if (altId && String(altId) !== String(userId)) {
        userIds.push(String(altId));
      }
      const username = (req.user as unknown as { username?: string })?.username;
      if (username) {
        userIds.push(String(username));
      }

      if (endpoint) {
        // Automatically claim any unlinked push subscription for the logged-in user
        PushSubscription.updateOne(
          { endpoint, userId: null },
          { $set: { userId: String(userId) } }
        ).catch(() => {});
      }
    }

    const orClauses: Record<string, unknown>[] = [];
    if (userIds.length > 0) {
      orClauses.push({ userId: { $in: userIds } });
    }
    if (endpoint) {
      orClauses.push({ endpoint });
    }

    const filter = {
      $or: orClauses,
      deletedAt: null,
    };

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

router.get('/trash', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const userId = req.user?.id || null;
    const endpoint = (req.query.endpoint as string | undefined) || null;

    if (!userId && !endpoint) {
      return sendSuccess(res, { notifications: [], totalCount: 0 });
    }

    const userIds: string[] = [];
    if (userId) {
      userIds.push(String(userId));
      const altId = req.user && (req.user as unknown as { _id?: string })._id;
      if (altId && String(altId) !== String(userId)) {
        userIds.push(String(altId));
      }
      const username = (req.user as unknown as { username?: string })?.username;
      if (username) {
        userIds.push(String(username));
      }
    }

    const orClauses: Record<string, unknown>[] = [];
    if (userIds.length > 0) {
      orClauses.push({ userId: { $in: userIds } });
    }
    if (endpoint) {
      orClauses.push({ endpoint });
    }

    const filter = {
      $or: orClauses,
      deletedAt: { $ne: null },
    };

    const [notifications, totalCount] = await Promise.all([
      InAppNotification.find(filter).sort({ deletedAt: -1 }).limit(50),
      InAppNotification.countDocuments(filter),
    ]);

    return sendSuccess(res, { notifications, totalCount });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Notifications] Fetch trash failed:', err);
    return sendError(res, err?.message || 'Failed to fetch notification trash', 500);
  }
});

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

router.post('/mark-all-read', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const endpoint = (req.body.endpoint as string | undefined) || null;

    if (!userId && !endpoint) {
      return sendSuccess(res, { modifiedCount: 0 });
    }

    const userOrEndpoint = userId
      ? { userId: String(userId) }
      : { endpoint, userId: null };

    const filter = {
      ...userOrEndpoint,
      deletedAt: null,
      isRead: false,
    };

    const result = await InAppNotification.updateMany(filter, { isRead: true });
    return sendSuccess(res, { modifiedCount: result.modifiedCount }, 'All notifications marked as read');
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to mark all as read', 500);
  }
});

router.post('/clear-all', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const endpoint = (req.body.endpoint as string | undefined) || null;

    if (!userId && !endpoint) {
      return sendSuccess(res, { modifiedCount: 0 });
    }

    const userOrEndpoint = userId
      ? { userId: String(userId) }
      : { endpoint, userId: null };

    const filter = {
      ...userOrEndpoint,
      deletedAt: null,
    };

    const result = await InAppNotification.updateMany(filter, {
      deletedAt: new Date(),
      isRead: true,
    });
    return sendSuccess(
      res,
      { modifiedCount: result.modifiedCount },
      'All notifications cleared and moved to trash'
    );
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to clear notifications', 500);
  }
});

router.patch('/:id/trash', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await InAppNotification.findByIdAndUpdate(
      id,
      { deletedAt: new Date(), isRead: true },
      { new: true }
    );
    if (!updated) {
      return sendError(res, 'Notification not found', 404);
    }
    return sendSuccess(res, updated, 'Notification moved to trash');
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to trash notification', 500);
  }
});

router.post('/:id/restore', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await InAppNotification.findByIdAndUpdate(
      id,
      { deletedAt: null },
      { new: true }
    );
    if (!updated) {
      return sendError(res, 'Notification not found', 404);
    }
    return sendSuccess(res, updated, 'Notification restored');
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to restore notification', 500);
  }
});

router.delete('/trash/empty', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const endpoint = (req.body?.endpoint as string | undefined) || (req.query?.endpoint as string | undefined) || null;

    if (!userId && !endpoint) {
      return sendSuccess(res, { deletedCount: 0 });
    }

    const userOrEndpoint = userId
      ? { userId: String(userId) }
      : { endpoint, userId: null };

    const filter = {
      ...userOrEndpoint,
      deletedAt: { $ne: null },
    };

    const result = await InAppNotification.deleteMany(filter);
    return sendSuccess(
      res,
      { deletedCount: result.deletedCount },
      'Notification trash emptied permanently'
    );
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to empty notification trash', 500);
  }
});

router.delete('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isPermanent = req.query.permanent === 'true';

    const existing = await InAppNotification.findById(id);
    if (!existing) {
      return sendError(res, 'Notification not found', 404);
    }

    if (isPermanent || existing.deletedAt) {
      await InAppNotification.findByIdAndDelete(id);
      return sendSuccess(res, null, 'Notification permanently removed');
    }

    existing.deletedAt = new Date();
    existing.isRead = true;
    await existing.save();
    return sendSuccess(res, existing, 'Notification moved to trash');
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to delete notification', 500);
  }
});

router.get('/preferences', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const userId = req.user?.id || null;
    const endpoint = (req.query.endpoint as string | undefined) || null;

    if (!userId && !endpoint) {
      return sendSuccess(res, { preferences: null });
    }

    const filter = userId
      ? { userId: String(userId) }
      : { endpoint };

    const sub = await PushSubscription.findOne(filter).sort({ updatedAt: -1 });
    return sendSuccess(res, { preferences: sub?.preferences || null });
  } catch (error: unknown) {
    const err = error as Error;
    return sendError(res, err?.message || 'Failed to fetch preferences', 500);
  }
});

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

router.get('/vapid-public-key', (_req, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return sendSuccess(res, { publicKey: getVapidPublicKey() });
});

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

interface SimulationTemplate {
  title: string;
  body: string;
  type: 'morning' | 'planning' | 'streak' | 'achievement' | 'trash' | 'system';
  url: string;
}

const DEFAULT_SIMULATION: SimulationTemplate = {
  title: '⚡ Taskiye System Connected!',
  body: 'Your device is verified and push notifications are fully operational.',
  type: 'system',
  url: '/',
};

const NOTIFICATION_SIMULATIONS: Record<string, SimulationTemplate> = {
  morning: {
    title: '☀️ Good Morning, Champion!',
    body: 'Start strong! 3 daily habits and your morning focus routine are ready.',
    type: 'morning',
    url: '/',
  },
  planning: {
    title: '🎯 Task Planning Check-in',
    body: 'Mid-day momentum: Time to organize priorities and conquer pending tasks.',
    type: 'planning',
    url: '/tasks',
  },
  streak: {
    title: '🔥 Streak Protection Alert!',
    body: 'Your streak is on the line! Complete at least 1 habit before midnight.',
    type: 'streak',
    url: '/habits',
  },
  achievement: {
    title: '🏆 Milestone Conquest Unlocked!',
    body: 'Outstanding consistency! All daily targets completed. Rank progress updated.',
    type: 'achievement',
    url: '/rank',
  },
  trash: {
    title: '🗑️ Trash Items Expiring Soon',
    body: 'Soft-deleted tasks in your junk bin will be permanently purged in 48 hours.',
    type: 'trash',
    url: '/',
  },
  system: DEFAULT_SIMULATION,
};

router.post('/test', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpoint, type = 'system' } = req.body || {};
    const userId = req.user?.id || null;

    const sim: SimulationTemplate = NOTIFICATION_SIMULATIONS[String(type)] ?? DEFAULT_SIMULATION;

    let sub = endpoint ? await PushSubscription.findOne({ endpoint }) : null;
    if (!sub && userId) {
      sub = await PushSubscription.findOne({ userId }).sort({ updatedAt: -1 });
    }

    const tag = `taskiye-sim-${sim.type}-${Date.now()}`;

    const result = await dispatchUnifiedNotification({
      sub,
      userId,
      endpoint: endpoint || sub?.endpoint || null,
      title: sim.title,
      body: sim.body,
      type: sim.type,
      tag,
      url: sim.url,
    });

    return sendSuccess(
      res,
      {
        dispatched: result.pushSent,
        inAppSaved: result.inAppSaved,
        type: sim.type,
        title: sim.title,
        body: sim.body,
        url: sim.url,
        tag,
      },
      `Simulated ${sim.type} notification processed`
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Notifications] Test alert failed:', err);
    return sendError(res, err?.message || 'Failed to send test alert', 500);
  }
});

export default router;
