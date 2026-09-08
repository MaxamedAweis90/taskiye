import { Router, Response } from 'express';
import { Task } from '../models/Task.js';
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

    return sendSuccess(res, tasks);
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
    const { title, date, sortOrder, isHabitInstance, habitId } = req.body;

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
      isCompleted: false,
      isHabitInstance: Boolean(isHabitInstance),
      habitId: habitId || null,
    });

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

    if (existingTask.isHabitInstance) {
      return sendError(
        res,
        'Habit instances cannot be deleted directly from daily view. Manage habits in Settings.',
        403
      );
    }

    await Task.deleteOne({ _id: id });
    return sendSuccess(res, { id }, 'Task deleted successfully');
  } catch (error) {
    return sendError(res, 'Failed to delete task', 500, error);
  }
});

export default router;
