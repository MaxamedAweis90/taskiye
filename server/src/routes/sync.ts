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

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { habits = [], tasks = [] } = req.body as {
      habits?: GuestHabitInput[];
      tasks?: GuestTaskInput[];
    };

    // 1. Boundary Guard: Reject excessively large payloads to protect server memory
    if (habits.length > 100 || tasks.length > 500) {
      return sendError(
        res,
        'Sync payload exceeds limits (max 100 habits, 500 tasks per request)',
        413
      );
    }

    const habitIdMap = new Map<string, string>();
    let createdHabitsCount = 0;
    let createdTasksCount = 0;

    // 2. Optimized Habit Migration: Single DB query for all existing habits
    const existingHabits = await Habit.find({ userId });
    const existingHabitsMap = new Map(
      existingHabits.map((h) => [h.title.toLowerCase().trim(), h])
    );

    const habitsToCreate: Array<Record<string, unknown>> = [];

    for (const item of habits) {
      if (!item.title || typeof item.title !== 'string') continue;
      const trimmedTitle = item.title.trim();
      const localKey = item.id || item.localId;
      const existing = existingHabitsMap.get(trimmedTitle.toLowerCase());

      if (!existing) {
        habitsToCreate.push({
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
          _localKey: localKey,
        });
      } else {
        if (localKey) {
          habitIdMap.set(localKey, existing._id.toString());
        }
        // Merge streak & completed dates if needed
        if (Array.isArray(item.completedDates) && item.completedDates.length > 0) {
          existing.completedDates = Array.from(
            new Set([...(existing.completedDates || []), ...item.completedDates])
          );
          existing.streakDays = Math.max(existing.streakDays || 0, item.streakDays || 0);
          existing.totalCompletions = Math.max(
            existing.totalCompletions || 0,
            item.totalCompletions || 0
          );
          await existing.save();
        }
      }
    }

    if (habitsToCreate.length > 0) {
      const inserted = await Habit.insertMany(habitsToCreate);
      createdHabitsCount = inserted.length;
      for (const h of inserted) {
        const localKey = (h as unknown as { _localKey?: string })._localKey;
        if (localKey) {
          habitIdMap.set(localKey, String((h as { _id?: unknown })._id));
        }
      }
    }

    // 3. Optimized Task Migration: Batch lookup and atomic bulk operations
    const validTasks = tasks.filter((t) => t.title && typeof t.title === 'string');
    if (validTasks.length > 0) {
      const validDates = validTasks
        .map((t) => new Date(t.date))
        .filter((d) => !isNaN(d.getTime()));

      const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
      minDate.setUTCHours(0, 0, 0, 0);
      const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));
      maxDate.setUTCHours(23, 59, 59, 999);

      // Single query for all existing tasks in the migration date span
      const existingTasks = await Task.find({
        userId,
        date: { $gte: minDate, $lte: maxDate },
      }).select('_id title date isCompleted habitId');

      const existingTaskMap = new Map<string, typeof existingTasks[0]>();
      for (const t of existingTasks) {
        const dKey = t.date ? new Date(t.date).toISOString().slice(0, 10) : '';
        existingTaskMap.set(`${t.title.toLowerCase().trim()}_${dKey}`, t);
      }

      const tasksToInsert: Array<Record<string, unknown>> = [];
      const bulkUpdates: Array<{
        updateOne: {
          filter: { _id: Types.ObjectId };
          update: { $set: Record<string, unknown> };
        };
      }> = [];

      for (const item of validTasks) {
        const taskDate = item.date ? new Date(item.date) : new Date();
        if (isNaN(taskDate.getTime())) continue;

        const dateKey = taskDate.toISOString().slice(0, 10);
        const mapKey = `${item.title.trim().toLowerCase()}_${dateKey}`;
        const existing = existingTaskMap.get(mapKey);

        const habitKey = item.habitId || item.habitLocalId;
        let resolvedHabitId = null;
        if (habitKey && habitIdMap.has(habitKey)) {
          resolvedHabitId = habitIdMap.get(habitKey);
        }

        if (!existing) {
          tasksToInsert.push({
            userId,
            title: item.title.trim(),
            date: taskDate,
            isCompleted: Boolean(item.isCompleted),
            isHabitInstance: Boolean(item.isHabitInstance),
            habitId: resolvedHabitId ? new Types.ObjectId(resolvedHabitId) : null,
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
            category: item.category || 'Routine Activity',
            priority: item.priority || 'normal',
          });
        } else if (item.isCompleted && !existing.isCompleted) {
          const updateSet: Record<string, unknown> = { isCompleted: true };
          if (resolvedHabitId && !existing.habitId) {
            updateSet.habitId = new Types.ObjectId(resolvedHabitId);
          }
          bulkUpdates.push({
            updateOne: {
              filter: { _id: existing._id },
              update: { $set: updateSet },
            },
          });
        }
      }

      if (tasksToInsert.length > 0) {
        const inserted = await Task.insertMany(tasksToInsert, { ordered: false });
        createdTasksCount = inserted.length;
      }

      if (bulkUpdates.length > 0) {
        await Task.bulkWrite(bulkUpdates);
      }
    }

    // Send account migration push notification if items were migrated
    if (createdHabitsCount > 0 || createdTasksCount > 0) {
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
        syncedHabitsCount: createdHabitsCount,
        syncedTasksCount: createdTasksCount,
        totalItemsMigrated: createdHabitsCount + createdTasksCount,
      },
      'Guest items synced successfully to account'
    );
  } catch (error) {
    return sendError(res, 'Failed to sync guest data', 500, error);
  }
});

export default router;
