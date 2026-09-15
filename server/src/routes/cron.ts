import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { PushSubscription } from '../models/PushSubscription.js';
import { Habit } from '../models/Habit.js';
import { Task } from '../models/Task.js';
import { mongoDb } from '../db/connection.js';
import { sendPushNotification } from '../lib/push.js';
import { sendSuccess, sendError } from '../utils/response.js';
import {
  renderTemplate,
  pickRandomTemplate,
  MORNING_CADENCE_TEMPLATES,
  ALL_COMPLETED_TEMPLATES,
  STREAK_AT_RISK_TEMPLATES,
  STREAK_FREEZE_MELTED_TEMPLATES,
  TRASH_EXPIRING_TEMPLATES,
  TRASH_PURGED_TEMPLATES,
} from '../lib/notificationTemplates.js';

const router = Router();

/**
 * GET /api/cron/reminders
 * Evaluates subscribers hourly, personalizes Duolingo-style copy, and sends targeted push alerts.
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

        // Prevent duplicate alerts on the same calendar day for this subscriber
        if (sub.lastNotifiedDate === localDate) {
          continue;
        }

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

        // 4. Scenario A: Check for Trash items near 30-day TTL expiration (Days 27, 28, 29, 30)
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

            const sent = await sendPushNotification(sub, {
              title: copy.title,
              body: copy.body,
              icon: '/logo.png',
              tag: `trash-warning-${oldestTrashItem._id}-${localDate}`,
              data: { url: '/' },
            });

            if (sent) {
              sentCount++;
              sub.lastNotifiedDate = localDate;
              await sub.save();
              continue;
            }
          } else if (daysInTrash >= 30) {
            const copy = renderTemplate(pickRandomTemplate(TRASH_PURGED_TEMPLATES), {
              firstName,
              itemName: oldestTrashItem.title,
            });

            const sent = await sendPushNotification(sub, {
              title: copy.title,
              body: copy.body,
              icon: '/logo.png',
              tag: `trash-purged-${oldestTrashItem._id}-${localDate}`,
              data: { url: '/' },
            });

            if (sent) {
              sentCount++;
              sub.lastNotifiedDate = localDate;
              await sub.save();
              continue;
            }
          }
        }

        // 5. Scenario B: Streak Freeze Worn Off (Next Day Notice)
        const frozenHabit = activeHabits.find((h) => h.isStreakFrozen);
        if (frozenHabit && frozenHabit.lastCompletedDate && frozenHabit.lastCompletedDate !== localDate) {
          const copy = renderTemplate(pickRandomTemplate(STREAK_FREEZE_MELTED_TEMPLATES), {
            firstName,
            streakDays: maxStreak,
          });

          const sent = await sendPushNotification(sub, {
            title: copy.title,
            body: copy.body,
            icon: '/logo.png',
            tag: `freeze-melted-${localDate}`,
            data: { url: '/habits' },
          });

          if (sent) {
            sentCount++;
            sub.lastNotifiedDate = localDate;
            await sub.save();
            continue;
          }
        }

        // 6. Scenario C: 100% Clearance Celebration (User finished all tasks/habits today)
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

          const sent = await sendPushNotification(sub, {
            title: copy.title,
            body: copy.body,
            icon: '/logo.png',
            tag: `all-completed-${localDate}`,
            data: { url: '/' },
          });

          if (sent) {
            sentCount++;
            sub.lastNotifiedDate = localDate;
            await sub.save();
            continue;
          }
        }

        // 7. Scenario D: Morning Cadence Kickoff (8:00 AM - 9:59 AM)
        if (localHour >= 8 && localHour <= 9 && sub.preferences?.dailyReminders) {
          const count = pendingTasksCount || activeHabits.length || 1;
          const copy = renderTemplate(pickRandomTemplate(MORNING_CADENCE_TEMPLATES), {
            firstName,
            pendingCount: count,
            streakDays: maxStreak,
          });

          const sent = await sendPushNotification(sub, {
            title: copy.title,
            body: copy.body,
            icon: '/logo.png',
            tag: `cadence-morning-${localDate}`,
            data: { url: '/habits' },
          });

          if (sent) {
            sentCount++;
            sub.lastNotifiedDate = localDate;
            await sub.save();
            continue;
          }
        }

        // 8. Scenario E: Evening Streak at Risk / Duolingo-Style Urgency (8:00 PM - 10:30 PM)
        if (localHour >= 20 && localHour <= 22 && sub.preferences?.dailyCadenceDigest) {
          const count = pendingTasksCount || 1;
          const copy = renderTemplate(pickRandomTemplate(STREAK_AT_RISK_TEMPLATES), {
            firstName,
            streakDays: maxStreak,
            pendingCount: count,
          });

          const sent = await sendPushNotification(sub, {
            title: copy.title,
            body: copy.body,
            icon: '/logo.png',
            tag: `streak-risk-${localDate}`,
            data: { url: '/' },
          });

          if (sent) {
            sentCount++;
            sub.lastNotifiedDate = localDate;
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
