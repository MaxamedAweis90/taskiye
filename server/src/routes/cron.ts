import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { PushSubscription } from '../models/PushSubscription.js';
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

/**
 * GET /api/cron/reminders
 * Evaluates subscribers, personalizes Duolingo-style copy, sends Web Push,
 * and saves In-App Notifications for the topbar bell counter.
 */
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

    for (const sub of subscriptions) {
      try {
        const tz = sub.timezone || 'UTC';

        // 1. Calculate user's current local hour and date string in their timezone
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

        // Helper to check and record alert history per category
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

        // 2. Fetch User Profile Info (First Name)
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

        // 3. Query User's Habits and Today's Tasks
        const userFilter = sub.userId ? { userId: sub.userId } : { userId: null };
        const activeHabits = await Habit.find({
          ...userFilter,
          isArchived: false,
          deletedAt: null,
        });

        const maxStreak = activeHabits.length > 0
          ? Math.max(...activeHabits.map((h) => h.streakDays || 0))
          : 0;

        // Today's date range for task querying
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

        // ====================================================================
        // Scenario A: Trash items near 30-day TTL expiration
        // ====================================================================
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
                sentCount++;
                recordSent('trashAlert');
                await sub.save();
                continue;
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
                sentCount++;
                recordSent('trashAlert');
                await sub.save();
                continue;
              }
            }
          }
        }

        // ====================================================================
        // Scenario B: Streak Freeze Worn Off (Next Day Notice)
        // ====================================================================
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
              sentCount++;
              recordSent('freezeMelted');
              await sub.save();
              continue;
            }
          }
        }

        // ====================================================================
        // Scenario C: 100% Clearance Celebration (User finished all tasks & habits)
        // ====================================================================
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
              sentCount++;
              recordSent('allCompleted');
              await sub.save();
              continue;
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
          // Remind user if they haven't planned tasks or have pending items to tackle
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
            sentCount++;
            recordSent('taskPlanning');
            await sub.save();
            continue;
          }
        }

        // ====================================================================
        // Scenario E: Morning Cadence Kickoff (Default: 08:00 AM)
        // ====================================================================
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
            sentCount++;
            recordSent('morningCadence');
            await sub.save();
            continue;
          }
        }

        // ====================================================================
        // Scenario F: Evening Streak at Risk / Duolingo-Style Urgency (8:00 PM - 10:30 PM)
        // ====================================================================
        const isEveningEnabled = sub.preferences?.dailyCadenceDigest !== false;
        if (
          isEveningEnabled &&
          !hasSentToday('streakRisk') &&
          localHour >= 20 &&
          localHour <= 22
        ) {
          const count = pendingTasksCount || 1;
          const copy = renderTemplate(pickRandomTemplate(STREAK_AT_RISK_TEMPLATES), {
            firstName,
            streakDays: maxStreak,
            pendingCount: count,
          });

          const result = await dispatchUnifiedNotification({
            sub,
            userId: sub.userId,
            endpoint: sub.endpoint,
            title: copy.title,
            body: copy.body,
            type: 'streak',
            tag: `streak-risk-${localDate}`,
            url: '/',
          });

          if (result.pushSent || result.inAppSaved) {
            sentCount++;
            recordSent('streakRisk');
            await sub.save();
            continue;
          }
        }
      } catch (subErr) {
        console.warn(`[Cron] Error processing subscription ${sub._id}:`, subErr);
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
