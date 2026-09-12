import { Router, Response } from 'express';
import { Task } from '../models/Task.js';
import { Habit } from '../models/Habit.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/**
 * GET /api/tasks
 * Query tasks by date (YYYY-MM-DD) or list recent tasks
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendSuccess(res, [], 'Guest mode: no remote tasks');
    }

    const filter: Record<string, unknown> = { userId: req.user.id };
    const dateQuery = req.query.date as string | undefined;

    if (dateQuery) {
      const parsedDate = new Date(dateQuery);
      if (isNaN(parsedDate.getTime())) {
        return sendError(res, 'Invalid date format (expected YYYY-MM-DD)', 400);
      }

      const startOfDay = new Date(parsedDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(parsedDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const tasks = await Task.find(filter)
      .sort({ sortOrder: 1, createdAt: 1 })
      .populate('habitId', 'title frequency isArchived');

    // Filter out habit instances whose parent habit has been deleted or archived
    const validTasks = tasks.filter((t) => {
      if (!t.isHabitInstance) return true;
      if (!t.habitId) return false;
      const habitObj = t.habitId as any;
      if (habitObj.isArchived) return false;
      return true;
    });

    // Clean up any orphaned habit instances in the background
    const orphanedIds = tasks
      .filter((t) => t.isHabitInstance && (!t.habitId || (t.habitId as any).isArchived))
      .map((t) => t._id);
    if (orphanedIds.length > 0) {
      Task.deleteMany({ _id: { $in: orphanedIds } }).catch(() => {});
    }

    return sendSuccess(res, validTasks);
  } catch (error) {
    return sendError(res, 'Failed to fetch tasks', 500, error);
  }
});

/**
 * POST /api/tasks
 * Create a new daily task
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, date, sortOrder, isHabitInstance, habitId, isCompleted } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return sendError(res, 'Task title is required', 400);
    }

    const taskDate = date ? new Date(date) : new Date();
    if (isNaN(taskDate.getTime())) {
      return sendError(res, 'Invalid task date provided', 400);
    }

    // If sortOrder isn't provided, assign the next available sortOrder for that day
    let calculatedSortOrder = typeof sortOrder === 'number' ? sortOrder : 0;
    if (sortOrder === undefined) {
      const highestSortTask = await Task.findOne({
        userId: req.user!.id,
        date: taskDate,
      }).sort({ sortOrder: -1 });

      calculatedSortOrder = highestSortTask ? highestSortTask.sortOrder + 1 : 0;
    }

    const task = await Task.create({
      userId: req.user!.id,
      title: title.trim(),
      date: taskDate,
      sortOrder: calculatedSortOrder,
      isCompleted: Boolean(isCompleted),
      isHabitInstance: Boolean(isHabitInstance),
      habitId: habitId || null,
    });

    // If a completed habit instance is created, update the habit counters (+1 completion, +1 streak, 0 warnings)
    if (task.isHabitInstance && task.habitId && task.isCompleted) {
      const todayStr = new Date().toISOString().slice(0, 10);
      await Habit.findOneAndUpdate(
        { _id: task.habitId, userId: req.user!.id },
        {
          $inc: { totalCompletions: 1, streakDays: 1 },
          $set: { warnings: 0, lastCompletedDate: todayStr, isArchived: false },
        }
      );
    }

    return sendSuccess(res, task, 'Task created successfully', 201);
  } catch (error) {
    return sendError(res, 'Failed to create task', 500, error);
  }
});

/**
 * PATCH /api/tasks/reorder
 * Batch update sortOrder for reordered daily tasks
 */
router.patch('/reorder', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items } = req.body as { items?: Array<{ id: string; sortOrder: number }> };

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 'Items array with id and sortOrder required', 400);
    }

    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { _id: item.id, userId: req.user!.id },
        update: { $set: { sortOrder: item.sortOrder } },
      },
    }));

    await Task.bulkWrite(bulkOps);

    return sendSuccess(res, { updatedCount: items.length }, 'Tasks reordered successfully');
  } catch (error) {
    return sendError(res, 'Failed to batch reorder tasks', 500, error);
  }
});

/**
 * PATCH /api/tasks/:id
 * Update task completion state, title, or date
 */
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isCompleted, title, date, sortOrder } = req.body;

    const updateFields: Record<string, unknown> = {};
    if (typeof isCompleted === 'boolean') updateFields.isCompleted = isCompleted;
    if (typeof title === 'string' && title.trim()) updateFields.title = title.trim();
    if (typeof sortOrder === 'number') updateFields.sortOrder = sortOrder;
    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) updateFields.date = parsedDate;
    }

    const task = await Task.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $set: updateFields },
      { new: true }
    );

    if (!task) {
      return sendError(res, 'Task not found or unauthorized', 404);
    }

    // Sync habit completion & streak counters (NEVER set isArchived: true!)
    if (typeof isCompleted === 'boolean' && task.isHabitInstance && task.habitId) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (isCompleted) {
        // Checking off: +1 completion, +1 streak, clear warnings to 0
        await Habit.findOneAndUpdate(
          { _id: task.habitId, userId: req.user!.id },
          {
            $inc: { totalCompletions: 1, streakDays: 1 },
            $set: { warnings: 0, lastCompletedDate: todayStr, isArchived: false },
          }
        );
      } else {
        // Unchecking: -1 completion, -1 streak (floor at 0)
        const linkedHabit = await Habit.findOne({ _id: task.habitId, userId: req.user!.id });
        if (linkedHabit) {
          const nextCompletions = Math.max(0, (linkedHabit.totalCompletions || 0) - 1);
          const nextStreak = Math.max(0, (linkedHabit.streakDays || 0) - 1);
          await Habit.updateOne(
            { _id: task.habitId, userId: req.user!.id },
            {
              $set: {
                totalCompletions: nextCompletions,
                streakDays: nextStreak,
                lastCompletedDate: null,
                isArchived: false,
              },
            }
          );
        }
      }
    }

    return sendSuccess(res, task, 'Task updated successfully');
  } catch (error) {
    return sendError(res, 'Failed to update task', 500, error);
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task (Habit instances are protected from deletion)
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingTask = await Task.findOne({ _id: id, userId: req.user!.id });
    if (!existingTask) {
      return sendError(res, 'Task not found or unauthorized', 404);
    }

    // Allow deleting any daily task or habit instance
    await Task.deleteOne({ _id: id });
    return sendSuccess(res, { id }, 'Task deleted successfully');
  } catch (error) {
    return sendError(res, 'Failed to delete task', 500, error);
  }
});

export default router;
