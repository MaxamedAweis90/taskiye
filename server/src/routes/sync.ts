import { Router, Response } from 'express';
import { Habit } from '../models/Habit.js';
import { Task } from '../models/Task.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

interface GuestHabitInput {
  localId?: string;
  title: string;
  frequency?: string;
  isArchived?: boolean;
}

interface GuestTaskInput {
  localId?: string;
  title: string;
  date: string | Date;
  isCompleted?: boolean;
  isHabitInstance?: boolean;
  habitLocalId?: string;
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

      const newHabit = await Habit.create({
        userId,
        title: item.title.trim(),
        frequency: item.frequency?.trim() || 'daily',
        isArchived: Boolean(item.isArchived),
      });

      createdHabits.push(newHabit);
      if (item.localId) {
        habitIdMap.set(item.localId, newHabit._id.toString());
      }
    }

    // 2. Migrate guest tasks
    const createdTasks = [];
    for (const item of tasks) {
      if (!item.title || typeof item.title !== 'string') continue;

      const taskDate = item.date ? new Date(item.date) : new Date();
      if (isNaN(taskDate.getTime())) continue;

      // Link to newly created habit instance if habitLocalId was mapped
      let resolvedHabitId = null;
      if (item.habitLocalId && habitIdMap.has(item.habitLocalId)) {
        resolvedHabitId = habitIdMap.get(item.habitLocalId);
      }

      const newTask = await Task.create({
        userId,
        title: item.title.trim(),
        date: taskDate,
        isCompleted: Boolean(item.isCompleted),
        isHabitInstance: Boolean(item.isHabitInstance),
        habitId: resolvedHabitId,
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
      });

      createdTasks.push(newTask);
    }

    return sendSuccess(
      res,
      {
        syncedHabitsCount: createdHabits.length,
        syncedTasksCount: createdTasks.length,
        habits: createdHabits,
        tasks: createdTasks,
      },
      'Guest items synced successfully to account'
    );
  } catch (error) {
    return sendError(res, 'Failed to sync guest data', 500, error);
  }
});

export default router;
