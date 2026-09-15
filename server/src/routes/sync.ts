import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { Habit } from '../models/Habit.js';
import { Task } from '../models/Task.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { sendPushNotification } from '../lib/push.js';
import { renderTemplate, pickRandomTemplate, GUEST_MIGRATION_TEMPLATES } from '../lib/notificationTemplates.js';

const router = Router();

interface GuestHabitInput {
  id?: string;
  localId?: string;
  title: string;
  category?: string;
  frequency?: string;
  timeOfDay?: string;
  targetUnit?: string;
  streakDays?: number;
  totalCompletions?: number;
  warnings?: number;
  lastCompletedDate?: string | null;
  lastStreak?: number;
  isStreakFrozen?: boolean;
  completedDates?: string[];
  activeDays?: number[];
  isArchived?: boolean;
}

interface GuestTaskInput {
  id?: string;
  localId?: string;
  title: string;
  date: string | Date;
  isCompleted?: boolean;
  isHabitInstance?: boolean;
  habitId?: string;
  habitLocalId?: string;
  category?: string;
  priority?: 'normal' | 'high';
  timeTag?: string;
  sortOrder?: number;
}

/**
 * POST /api/sync
 * Batch merges guest tasks and habits from Zustand localStorage into MongoDB upon user sign-in.
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { habits = [], tasks = [] } = req.body as {
      habits?: GuestHabitInput[];
      tasks?: GuestTaskInput[];
    };

    const habitIdMap = new Map<string, string>();
    const createdHabits = [];

    // 1. Migrate guest habits
    for (const item of habits) {
      if (!item.title || typeof item.title !== 'string') continue;

      const trimmedTitle = item.title.trim();
      const localKey = item.id || item.localId;

      // Check if habit already exists for user to ensure idempotency
      let habitRecord = await Habit.findOne({ userId, title: trimmedTitle });

      if (!habitRecord) {
        habitRecord = await Habit.create({
          userId,
          title: trimmedTitle,
          category: item.category?.trim() || 'Health & Fitness',
          frequency: item.frequency?.trim() || 'daily',
          timeOfDay: item.timeOfDay?.trim() || 'Morning (08:00 AM)',
          targetUnit: item.targetUnit?.trim() || 'sessions',
          streakDays: item.streakDays ?? 0,
          totalCompletions: item.totalCompletions ?? 0,
          warnings: item.warnings ?? 0,
          lastCompletedDate: item.lastCompletedDate || null,
          lastStreak: item.lastStreak ?? 0,
          isStreakFrozen: Boolean(item.isStreakFrozen),
          completedDates: Array.isArray(item.completedDates) ? item.completedDates : [],
          activeDays: Array.isArray(item.activeDays) ? item.activeDays : [0, 1, 2, 3, 4, 5, 6],
          isArchived: Boolean(item.isArchived),
        });
        createdHabits.push(habitRecord);
      } else {
        // Merge completed dates and max streak if existing
        if (Array.isArray(item.completedDates) && item.completedDates.length > 0) {
          habitRecord.completedDates = Array.from(
            new Set([...(habitRecord.completedDates || []), ...item.completedDates])
          );
          habitRecord.streakDays = Math.max(habitRecord.streakDays || 0, item.streakDays || 0);
          habitRecord.totalCompletions = Math.max(
            habitRecord.totalCompletions || 0,
            item.totalCompletions || 0
          );
          await habitRecord.save();
        }
      }

      if (localKey) {
        habitIdMap.set(localKey, habitRecord._id.toString());
      }
    }

    // 2. Migrate guest tasks
    const createdTasks = [];
    for (const item of tasks) {
      if (!item.title || typeof item.title !== 'string') continue;

      const taskDate = item.date ? new Date(item.date) : new Date();
      if (isNaN(taskDate.getTime())) continue;

      // Link to newly created habit instance if habit ID was mapped
      const habitKey = item.habitId || item.habitLocalId;
      let resolvedHabitId = null;
      if (habitKey && habitIdMap.has(habitKey)) {
        resolvedHabitId = habitIdMap.get(habitKey);
      }

      const startOfDay = new Date(taskDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(taskDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      // Check if task already exists for that day to avoid duplicate entries
      const existingTask = await Task.findOne({
        userId,
        title: item.title.trim(),
        date: { $gte: startOfDay, $lte: endOfDay },
      });

      if (!existingTask) {
        const newTask = await Task.create({
          userId,
          title: item.title.trim(),
          date: taskDate,
          isCompleted: Boolean(item.isCompleted),
          isHabitInstance: Boolean(item.isHabitInstance),
          habitId: resolvedHabitId ? new Types.ObjectId(resolvedHabitId) : null,
          sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
        });

        createdTasks.push(newTask);
      } else if (item.isCompleted && !existingTask.isCompleted) {
        existingTask.isCompleted = true;
        if (resolvedHabitId && !existingTask.habitId) {
          existingTask.habitId = new Types.ObjectId(resolvedHabitId);
        }
        await existingTask.save();
      }
    }

    // Send account migration push notification if items were migrated
    if (createdHabits.length > 0 || createdTasks.length > 0) {
      try {
        const sub = await PushSubscription.findOne({ userId });
        if (sub) {
          const firstName = req.user?.name?.trim()?.split(' ')[0] || req.user?.username || 'Champion';
          const copy = renderTemplate(pickRandomTemplate(GUEST_MIGRATION_TEMPLATES), { firstName });
          sendPushNotification(sub, {
            title: copy.title,
            body: copy.body,
            icon: '/logo.png',
            tag: `migration-welcome-${userId}`,
            data: { url: '/' },
          }).catch(() => null);
        }
      } catch (notifErr) {
        console.warn('[Sync] Migration notification warning:', notifErr);
      }
    }

    return sendSuccess(
      res,
      {
        syncedHabitsCount: createdHabits.length,
        syncedTasksCount: createdTasks.length,
        totalItemsMigrated: createdHabits.length + createdTasks.length,
      },
      'Guest items synced successfully to account'
    );
  } catch (error) {
    return sendError(res, 'Failed to sync guest data', 500, error);
  }
});

export default router;
