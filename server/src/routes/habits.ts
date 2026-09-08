import { Router, Response } from 'express';
import { Habit } from '../models/Habit.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/**
 * GET /api/habits
 * Fetch active habits for the authenticated user (or empty array for unauthenticated guests)
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendSuccess(res, [], 'Guest mode: no remote habits');
    }

    const includeArchived = req.query.includeArchived === 'true';
    const filter: Record<string, unknown> = { userId: req.user.id };

    if (!includeArchived) {
      filter.isArchived = false;
    }

    const habits = await Habit.find(filter).sort({ createdAt: -1 });
    return sendSuccess(res, habits);
  } catch (error) {
    return sendError(res, 'Failed to fetch habits', 500, error);
  }
});

/**
 * POST /api/habits
 * Create a new habit (Requires authentication per specs)
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, frequency } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return sendError(res, 'Habit title is required', 400);
    }

    const habit = await Habit.create({
      userId: req.user!.id,
      title: title.trim(),
      frequency: frequency?.trim() || 'daily',
      isArchived: false,
    });

    return sendSuccess(res, habit, 'Habit created successfully', 201);
  } catch (error) {
    return sendError(res, 'Failed to create habit', 500, error);
  }
});

/**
 * DELETE /api/habits/:id
 * Soft-delete / archive habit (Requires authentication)
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const habit = await Habit.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { isArchived: true },
      { new: true }
    );

    if (!habit) {
      return sendError(res, 'Habit not found or unauthorized', 404);
    }

    return sendSuccess(res, habit, 'Habit archived successfully');
  } catch (error) {
    return sendError(res, 'Failed to archive habit', 500, error);
  }
});

/**
 * PATCH /api/habits/:id
 * Update an existing habit
 */
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, frequency, isArchived } = req.body;

    const updateFields: Record<string, unknown> = {};
    if (typeof title === 'string' && title.trim()) updateFields.title = title.trim();
    if (typeof frequency === 'string') updateFields.frequency = frequency.trim();
    if (typeof isArchived === 'boolean') updateFields.isArchived = isArchived;

    const habit = await Habit.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $set: updateFields },
      { new: true }
    );

    if (!habit) {
      return sendError(res, 'Habit not found or unauthorized', 404);
    }

    return sendSuccess(res, habit, 'Habit updated successfully');
  } catch (error) {
    return sendError(res, 'Failed to update habit', 500, error);
  }
});

export default router;
