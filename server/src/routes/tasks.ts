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

    const filter: Record<string, unknown> = {
      userId: req.user.id,
      deletedAt: null,
    };
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
      .populate('habitId', 'title frequency isArchived category timeOfDay streakDays warnings isStreakFrozen');

    // Filter out habit instances whose parent habit has been deleted or archived
    const validTasks = tasks.filter((t) => {
      if (!t.isHabitInstance) return true;
      if (!t.habitId) return false;
      const habitObj = t.habitId as unknown as { isArchived?: boolean };
      if (habitObj.isArchived) return false;
      return true;
    });

    // Clean up any orphaned habit instances in the background
    const orphanedIds = tasks
      .filter((t) => t.isHabitInstance && (!t.habitId || (t.habitId as unknown as { isArchived?: boolean }).isArchived))
      .map((t) => t._id);
    if (orphanedIds.length > 0) {
      Task.deleteMany({ _id: { $in: orphanedIds } }).catch(() => {});
    }

    // Deduplicate any accidental duplicate habit tasks for the same habit and date
    const seenHabits = new Map<string, (typeof validTasks)[0]>();
    const deduplicatedTasks: (typeof validTasks)[0][] = [];
    const duplicateIdsToDelete: unknown[] = [];

    for (const t of validTasks) {
      if (t.isHabitInstance && t.habitId) {
        const rawHabit = t.habitId as unknown as { _id?: { toString: () => string } };
        const habitKey = rawHabit._id ? rawHabit._id.toString() : String(t.habitId);
        const existing = seenHabits.get(habitKey);
        if (!existing) {
          seenHabits.set(habitKey, t);
          deduplicatedTasks.push(t);
        } else {
          // If the new one is completed while existing is not, prioritize the completed one
          if (!existing.isCompleted && t.isCompleted) {
            const idx = deduplicatedTasks.indexOf(existing);
            if (idx !== -1) deduplicatedTasks[idx] = t;
            duplicateIdsToDelete.push(existing._id);
            seenHabits.set(habitKey, t);
          } else {
            duplicateIdsToDelete.push(t._id);
          }
        }
      } else {
        deduplicatedTasks.push(t);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      Task.deleteMany({ _id: { $in: duplicateIdsToDelete } }).catch(() => {});
    }

    return sendSuccess(res, deduplicatedTasks);
  } catch (error) {
    return sendError(res, 'Failed to fetch tasks', 500, error);
  }
});

/**
 * GET /api/tasks/activity
 * Aggregate historical completed and total tasks by date (YYYY-MM-DD)
 * for heatmap matrix rendering. Retains past completions.
 */
router.get('/activity', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendSuccess(res, {}, 'Guest mode: no remote activity');
    }

    const userId = req.user.id;

    // Fetch tasks from the last 365 days
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    oneYearAgo.setUTCHours(0, 0, 0, 0);

    const tasks = await Task.find({
      userId,
      deletedAt: null,
      date: { $gte: oneYearAgo },
    }).select('date isCompleted isHabitInstance habitId');

    const activityMap: Record<string, { completedCount: number; totalCount: number }> = {};

    for (const task of tasks) {
      if (!task.date) continue;
      const dateStr = new Date(task.date).toISOString().slice(0, 10);
      if (!activityMap[dateStr]) {
        activityMap[dateStr] = { completedCount: 0, totalCount: 0 };
      }
      activityMap[dateStr].totalCount += 1;
      if (task.isCompleted) {
        activityMap[dateStr].completedCount += 1;
      }
    }

    // Merge completedDates from habits (in case completed via Habit view directly)
    const habits = await Habit.find({ userId, isArchived: false, deletedAt: null }).select('completedDates');
    for (const habit of habits) {
      if (Array.isArray(habit.completedDates)) {
        for (const dateStr of habit.completedDates) {
          if (!activityMap[dateStr]) {
            activityMap[dateStr] = { completedCount: 1, totalCount: 1 };
          } else if (activityMap[dateStr].completedCount === 0) {
            activityMap[dateStr].completedCount = 1;
            activityMap[dateStr].totalCount = Math.max(activityMap[dateStr].totalCount, 1);
          }
        }
      }
    }

    return sendSuccess(res, activityMap);
  } catch (error) {
    return sendError(res, 'Failed to fetch activity logs', 500, error);
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

    // Check if a habit task already exists for this date and habit
    if (isHabitInstance && habitId) {
      const startOfDay = new Date(taskDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(taskDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const existingTask = await Task.findOne({
        userId: req.user!.id,
        habitId,
        date: { $gte: startOfDay, $lte: endOfDay },
      });

      if (existingTask) {
        if (typeof isCompleted === 'boolean' && existingTask.isCompleted !== isCompleted) {
          existingTask.isCompleted = isCompleted;
          await existingTask.save();

          if (isCompleted) {
            const todayStr = taskDate.toISOString().slice(0, 10);
            const linkedHabit = await Habit.findOne({ _id: habitId, userId: req.user!.id });
            const isAlreadyCompletedToday = linkedHabit?.lastCompletedDate === todayStr;
            await Habit.findOneAndUpdate(
              { _id: habitId, userId: req.user!.id },
              {
                $inc: {
                  totalCompletions: 1,
                  streakDays: isAlreadyCompletedToday ? 0 : 1,
                },
                $set: { warnings: 0, lastCompletedDate: todayStr, isArchived: false },
                $addToSet: { completedDates: todayStr },
              }
            );
          }
        }
        return sendSuccess(res, existingTask, 'Task already exists, updated successfully', 200);
      }
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

    // If a completed habit instance is created, update the habit counters (+1 completion, streak if not already done today, 0 warnings, completedDates)
    if (task.isHabitInstance && task.habitId && task.isCompleted) {
      const todayStr = taskDate.toISOString().slice(0, 10);
      const linkedHabit = await Habit.findOne({ _id: task.habitId, userId: req.user!.id });
      const isAlreadyCompletedToday = linkedHabit?.lastCompletedDate === todayStr;
      await Habit.findOneAndUpdate(
        { _id: task.habitId, userId: req.user!.id },
        {
          $inc: {
            totalCompletions: 1,
            streakDays: isAlreadyCompletedToday ? 0 : 1,
          },
          $set: { warnings: 0, lastCompletedDate: todayStr, isArchived: false },
          $addToSet: { completedDates: todayStr },
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
      const taskDateObj = task.date ? new Date(task.date) : new Date();
      const taskDateStr = taskDateObj.toISOString().slice(0, 10);
      if (isCompleted) {
        // Checking off: only increment streak if not already completed on this date
        const linkedHabit = await Habit.findOne({ _id: task.habitId, userId: req.user!.id });
        const isAlreadyCompletedToday = linkedHabit?.lastCompletedDate === taskDateStr;
        await Habit.findOneAndUpdate(
          { _id: task.habitId, userId: req.user!.id },
          {
            $inc: {
              totalCompletions: 1,
              streakDays: isAlreadyCompletedToday ? 0 : 1,
            },
            $set: { warnings: 0, lastCompletedDate: taskDateStr, isArchived: false },
            $addToSet: { completedDates: taskDateStr },
          }
        );
      } else {
        // Unchecking: check if there are other completed tasks for this habit on this date
        const otherCompletedToday = await Task.findOne({
          _id: { $ne: task._id },
          userId: req.user!.id,
          habitId: task.habitId,
          date: {
            $gte: new Date(`${taskDateStr}T00:00:00.000Z`),
            $lte: new Date(`${taskDateStr}T23:59:59.999Z`),
          },
          isCompleted: true,
        });

        if (!otherCompletedToday) {
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
                $pull: { completedDates: taskDateStr },
              }
            );
          }
        }
      }
    }

    return sendSuccess(res, task, 'Task updated successfully');
  } catch (error) {
    return sendError(res, 'Failed to update task', 500, error);
  }
});

/**
 * GET /api/tasks/trash
 * Fetch all soft-deleted standalone tasks for the authenticated user (within 30-day retention window)
 * Explicitly excludes habit instances so deleted habits don't duplicate inside tasks trash.
 */
router.get('/trash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const trashedTasks = await Task.find({
      userId: req.user!.id,
      deletedAt: { $ne: null },
      isHabitInstance: { $ne: true },
      habitId: null,
    })
      .sort({ deletedAt: -1 })
      .populate('habitId', 'title category');

    return sendSuccess(res, trashedTasks, 'Trashed tasks fetched successfully');
  } catch (error) {
    return sendError(res, 'Failed to fetch trashed tasks', 500, error);
  }
});

/**
 * DELETE /api/tasks/trash/empty
 * Permanently purge all soft-deleted standalone tasks in the user's trash
 */
router.delete('/trash/empty', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await Task.deleteMany({
      userId: req.user!.id,
      deletedAt: { $ne: null },
      isHabitInstance: { $ne: true },
      habitId: null,
    });

    return sendSuccess(res, { deletedCount: result.deletedCount }, 'Tasks trash emptied successfully');
  } catch (error) {
    return sendError(res, 'Failed to empty tasks trash', 500, error);
  }
});

/**
 * POST /api/tasks/:id/restore
 * Restore a soft-deleted task back to active checklist
 */
router.post('/:id/restore', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const task = await Task.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $set: { deletedAt: null } },
      { new: true }
    );

    if (!task) {
      return sendError(res, 'Task not found or unauthorized', 404);
    }

    return sendSuccess(res, task, 'Task restored successfully');
  } catch (error) {
    return sendError(res, 'Failed to restore task', 500, error);
  }
});

/**
 * DELETE /api/tasks/:id
 * Soft-delete task (retained in 30-day Trash) or permanent hard-delete if ?permanent=true
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isPermanent = req.query.permanent === 'true';

    const existingTask = await Task.findOne({ _id: id, userId: req.user!.id });
    if (!existingTask) {
      return sendError(res, 'Task not found or unauthorized', 404);
    }

    if (isPermanent) {
      await Task.deleteOne({ _id: id, userId: req.user!.id });
      return sendSuccess(res, { id, permanent: true }, 'Task permanently deleted');
    }

    // Soft-delete with timestamp for 30-day TTL recovery window
    const softDeleted = await Task.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    return sendSuccess(res, softDeleted, 'Task moved to trash (30-day retention window)');
  } catch (error) {
    return sendError(res, 'Failed to delete task', 500, error);
  }
});

export default router;
