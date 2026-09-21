import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { PushSubscription, IPushSubscription } from '../models/PushSubscription.js';
import { Habit } from '../models/Habit.js';
import { Task } from '../models/Task.js';
import { mongoDb } from '../db/connection.js';
import { dispatchUnifiedNotification } from '../lib/push.js';
import { sendSuccess, sendError } from '../utils/response.js';
import {
  renderTemplate,
  pickRandomTemplate,
  MORNING_CADENCE_TEMPLATES,
  TASK_PLANNING_TEMPLATES,
  ALL_COMPLETED_TEMPLATES,
  STREAK_AT_RISK_TEMPLATES,
  STREAK_FREEZE_MELTED_TEMPLATES,
  TRASH_EXPIRING_TEMPLATES,
  TRASH_PURGED_TEMPLATES,
} from '../lib/notificationTemplates.js';

const router = Router();

async function processSubscriptionReminder(sub: IPushSubscription, now: Date): Promise<boolean> {
  try {
    const tz = sub.timezone || 'UTC';

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

    const alertHistory = sub.lastAlertsSent instanceof Map
      ? Object.fromEntries(sub.lastAlertsSent)
      : (sub.lastAlertsSent || {});

    const hasSentToday = (category: string): boolean => {
      return alertHistory[category] === localDate;
    };

    const recordSent = (category: string) => {
      if (!sub.lastAlertsSent) {
        sub.lastAlertsSent = {};
      }
      if (sub.lastAlertsSent instanceof Map) {
        sub.lastAlertsSent.set(category, localDate);
      } else {
        sub.lastAlertsSent[category] = localDate;
      }
      sub.lastNotifiedDate = localDate;
    };

    let firstName = 'Champion';
    if (sub.userId) {
      try {
        let userDoc: { name?: string; username?: string } | null = null;
        if (ObjectId.isValid(sub.userId)) {
          userDoc = (await mongoDb.collection('user').findOne({
            _id: new ObjectId(sub.userId),
          })) as { name?: string; username?: string } | null;
        } else {
          userDoc = (await mongoDb.collection('user').findOne({
            id: sub.userId,
          })) as { name?: string; username?: string } | null;
        }

        if (userDoc?.name) {
          firstName = userDoc.name.trim().split(' ')[0] || 'Champion';
        } else if (userDoc?.username) {
          firstName = userDoc.username.trim();
        }
      } catch {
        // fallback to default
      }
    }

    const userFilter = sub.userId ? { userId: sub.userId } : { userId: null };
    const activeHabits = await Habit.find({
      ...userFilter,
      isArchived: false,
      deletedAt: null,
    });

    const maxStreak = activeHabits.length > 0
      ? Math.max(...activeHabits.map((h) => h.streakDays || 0))
      : 0;

    const startOfDay = new Date(localDate + 'T00:00:00.000Z');
    const endOfDay = new Date(localDate + 'T23:59:59.999Z');

    const todaysTasks = await Task.find({
      ...userFilter,
      deletedAt: null,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    const completedTasksCount = todaysTasks.filter((t) => t.isCompleted).length;
    const pendingTasksCount = todaysTasks.filter((t) => !t.isCompleted).length;
    const totalItemsCount = todaysTasks.length + activeHabits.length;

    // Scenario A: Trash items near 30-day TTL expiration
    if (!hasSentToday('trashAlert')) {
      const trashedTasks = await Task.find({
        ...userFilter,
        deletedAt: { $ne: null },
      }).sort({ deletedAt: 1 }).limit(1);

      const trashedHabits = await Habit.find({
        ...userFilter,
        deletedAt: { $ne: null },
      }).sort({ deletedAt: 1 }).limit(1);

      const oldestTrashItem = trashedTasks[0] || trashedHabits[0];

      if (oldestTrashItem?.deletedAt) {
        const deletedTime = new Date(oldestTrashItem.deletedAt).getTime();
        const daysInTrash = Math.floor((now.getTime() - deletedTime) / (1000 * 60 * 60 * 24));

        if (daysInTrash >= 27 && daysInTrash <= 29) {
          const daysLeft = 30 - daysInTrash;
          const copy = renderTemplate(pickRandomTemplate(TRASH_EXPIRING_TEMPLATES), {
            firstName,
            itemName: oldestTrashItem.title,
            daysLeft,
          });

          const result = await dispatchUnifiedNotification({
            sub,
            userId: sub.userId,
            endpoint: sub.endpoint,
            title: copy.title,
            body: copy.body,
            type: 'trash',
            tag: `trash-warning-${oldestTrashItem._id}-${localDate}`,
            url: '/',
          });

          if (result.pushSent || result.inAppSaved) {
            recordSent('trashAlert');
            await sub.save();
            return true;
          }
        } else if (daysInTrash >= 30) {
          const copy = renderTemplate(pickRandomTemplate(TRASH_PURGED_TEMPLATES), {
            firstName,
            itemName: oldestTrashItem.title,
          });

          const result = await dispatchUnifiedNotification({
            sub,
            userId: sub.userId,
            endpoint: sub.endpoint,
            title: copy.title,
            body: copy.body,
            type: 'trash',
            tag: `trash-purged-${oldestTrashItem._id}-${localDate}`,
            url: '/',
          });

          if (result.pushSent || result.inAppSaved) {
            recordSent('trashAlert');
            await sub.save();
            return true;
          }
        }
      }
    }

    // Scenario B: Streak Freeze Worn Off (Next Day Notice)
    if (!hasSentToday('freezeMelted')) {
      const frozenHabit = activeHabits.find((h) => h.isStreakFrozen);
      if (frozenHabit && frozenHabit.lastCompletedDate && frozenHabit.lastCompletedDate !== localDate) {
        const copy = renderTemplate(pickRandomTemplate(STREAK_FREEZE_MELTED_TEMPLATES), {
          firstName,
          streakDays: maxStreak,
        });

        const result = await dispatchUnifiedNotification({
          sub,
          userId: sub.userId,
          endpoint: sub.endpoint,
          title: copy.title,
          body: copy.body,
          type: 'streak',
          tag: `freeze-melted-${localDate}`,
          url: '/habits',
        });

        if (result.pushSent || result.inAppSaved) {
          recordSent('freezeMelted');
          await sub.save();
          return true;
        }
      }
    }

    // Scenario C: 100% Clearance Celebration (User finished all tasks & habits)
    if (!hasSentToday('allCompleted')) {
      if (
        totalItemsCount > 0 &&
        pendingTasksCount === 0 &&
        completedTasksCount > 0 &&
        localHour >= 12
      ) {
        const copy = renderTemplate(pickRandomTemplate(ALL_COMPLETED_TEMPLATES), {
          firstName,
          streakDays: maxStreak,
        });

        const result = await dispatchUnifiedNotification({
          sub,
          userId: sub.userId,
          endpoint: sub.endpoint,
          title: copy.title,
          body: copy.body,
          type: 'achievement',
          tag: `all-completed-${localDate}`,
          url: '/',
        });

        if (result.pushSent || result.inAppSaved) {
          recordSent('allCompleted');
          await sub.save();
          return true;
        }
      }
    }

    // ====================================================================
    // Scenario D: Daily Task Planning Reminder ("Plan Today's Priorities")
    // User-selected preferred hour (default: 09:00 AM)
    // ====================================================================
    const isPlanningEnabled = sub.preferences?.taskPlanningReminder !== false;
    const planningTimeStr = sub.preferences?.taskPlanningTime || '09:00';
    const targetPlanningHour = parseInt(planningTimeStr.split(':')[0] || '9', 10) || 9;

    if (
      isPlanningEnabled &&
      !hasSentToday('taskPlanning') &&
      localHour >= targetPlanningHour &&
      localHour <= targetPlanningHour + 2
    ) {
      const count = pendingTasksCount || 3;
      const copy = renderTemplate(pickRandomTemplate(TASK_PLANNING_TEMPLATES), {
        firstName,
        pendingCount: count,
        streakDays: maxStreak,
      });

      const result = await dispatchUnifiedNotification({
        sub,
        userId: sub.userId,
        endpoint: sub.endpoint,
        title: copy.title,
        body: copy.body,
        type: 'planning',
        tag: `task-planning-${localDate}`,
        url: '/',
      });

      if (result.pushSent || result.inAppSaved) {
        recordSent('taskPlanning');
        await sub.save();
        return true;
      }
    }

    // Scenario E: Morning Cadence Kickoff (Default: 08:00 AM)
    const isMorningEnabled = sub.preferences?.dailyReminders !== false;
    const morningTimeStr = sub.preferences?.morningReminderTime || '08:00';
    const targetMorningHour = parseInt(morningTimeStr.split(':')[0] || '8', 10) || 8;

    if (
      isMorningEnabled &&
      !hasSentToday('morningCadence') &&
      localHour >= targetMorningHour &&
      localHour <= targetMorningHour + 2
    ) {
      const count = pendingTasksCount || activeHabits.length || 1;
      const copy = renderTemplate(pickRandomTemplate(MORNING_CADENCE_TEMPLATES), {
        firstName,
        pendingCount: count,
        streakDays: maxStreak,
      });

      const result = await dispatchUnifiedNotification({
        sub,
        userId: sub.userId,
        endpoint: sub.endpoint,
        title: copy.title,
        body: copy.body,
        type: 'morning',
        tag: `cadence-morning-${localDate}`,
        url: '/habits',
      });

      if (result.pushSent || result.inAppSaved) {
        recordSent('morningCadence');
        await sub.save();
        return true;
      }
    }

    // ====================================================================
    // Scenario F: Evening Streak at Risk / Multi-Tier Midnight Countdown
    // (8:00 PM, 3hr left at 9:00 PM, 2hr left at 10:00 PM, 1hr left at 11:00 PM)
    // ====================================================================
    const isEveningEnabled = sub.preferences?.dailyCadenceDigest !== false;
    const uncompletedHabitsCount = activeHabits.filter(
      (h) => !h.completedDates?.includes(localDate) && h.lastCompletedDate !== localDate
    ).length;
    const totalRemainingTonight = pendingTasksCount + uncompletedHabitsCount;

    if (isEveningEnabled && totalRemainingTonight > 0) {
      // Tier 1: 1 Hour Before Midnight (23:00 / 11:00 PM) - Final Call Urgency
      if (localHour === 23 && !hasSentToday('streakRisk_1h')) {
        const result = await dispatchUnifiedNotification({
          sub,
          userId: sub.userId,
          endpoint: sub.endpoint,
          title: '🚨 Final Call: 1 Hour Left!',
          body: `Midnight is almost here, ${firstName}! Only 1 hour left to complete your habits and protect your ${maxStreak}-day streak!`,
          type: 'streak',
          tag: `streak-risk-1h-${localDate}`,
          url: '/',
        });

        if (result.pushSent || result.inAppSaved) {
          recordSent('streakRisk_1h');
          await sub.save();
          return true;
        }
      }

      // Tier 2: 2 Hours Before Midnight (22:00 / 10:00 PM) - High Danger Urgency
      if (localHour === 22 && !hasSentToday('streakRisk_2h')) {
        const result = await dispatchUnifiedNotification({
          sub,
          userId: sub.userId,
          endpoint: sub.endpoint,
          title: '🔥 2 Hours Left! Streak in Danger!',
          body: `Don't let your ${maxStreak}-day streak freeze or reset, ${firstName}. Only 2 hours left to finish your remaining ${totalRemainingTonight} item${totalRemainingTonight === 1 ? '' : 's'}!`,
          type: 'streak',
          tag: `streak-risk-2h-${localDate}`,
          url: '/',
        });

        if (result.pushSent || result.inAppSaved) {
          recordSent('streakRisk_2h');
          await sub.save();
          return true;
        }
      }

      // Tier 3: 3 Hours Before Midnight (21:00 / 9:00 PM) - Approaching Midnight Alert
      if (localHour === 21 && !hasSentToday('streakRisk_3h')) {
        const result = await dispatchUnifiedNotification({
          sub,
          userId: sub.userId,
          endpoint: sub.endpoint,
          title: '⏳ 3 Hours Left Before Midnight!',
          body: `Evening check-in, ${firstName}! You have ${totalRemainingTonight} pending item${totalRemainingTonight === 1 ? '' : 's'} before midnight resets today's checklist.`,
          type: 'streak',
          tag: `streak-risk-3h-${localDate}`,
          url: '/',
        });

        if (result.pushSent || result.inAppSaved) {
          recordSent('streakRisk_3h');
          await sub.save();
          return true;
        }
      }

      // Tier 4: Evening Kickoff (20:00 / 8:00 PM)
      if (localHour === 20 && !hasSentToday('streakRisk_8pm')) {
        const copy = renderTemplate(pickRandomTemplate(STREAK_AT_RISK_TEMPLATES), {
          firstName,
          streakDays: maxStreak,
          pendingCount: totalRemainingTonight,
        });

        const result = await dispatchUnifiedNotification({
          sub,
          userId: sub.userId,
          endpoint: sub.endpoint,
          title: copy.title,
          body: copy.body,
          type: 'streak',
          tag: `streak-risk-8pm-${localDate}`,
          url: '/',
        });

        if (result.pushSent || result.inAppSaved) {
          recordSent('streakRisk_8pm');
          await sub.save();
          return true;
        }
      }
    }

    return false;
  } catch (subErr) {
    console.warn(`[Cron] Error processing subscription ${sub._id}:`, subErr);
    return false;
  }
}

router.get('/reminders', async (req: Request, res: Response) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;
    const queryKey = (req.query.key as string | undefined) || (req.query.secret as string | undefined);
    const customHeader = req.headers['x-cron-secret'];

    // Secure endpoint when CRON_SECRET is configured in production
    if (cronSecret) {
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` ||
        queryKey === cronSecret ||
        customHeader === cronSecret;

      if (!isAuthorized) {
        return sendError(res, 'Unauthorized cron invocation', 401);
      }
    }

    const subscriptions = await PushSubscription.find({});
    let sentCount = 0;
    const now = new Date();

    // Process push alerts concurrently in batches of 15 to prevent serverless timeouts
    const BATCH_SIZE = 15;
    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((sub) => processSubscriptionReminder(sub, now))
      );
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value) {
          sentCount++;
        }
      }
    }

    return sendSuccess(
      res,
      {
        totalSubscribers: subscriptions.length,
        dispatchedAlerts: sentCount,
        timestamp: now.toISOString(),
      },
      'Personalized cron cycle completed'
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Cron] Reminder scheduler encountered error:', err);
    return sendError(res, err?.message || 'Cron execution failed', 500);
  }
});

export default router;
