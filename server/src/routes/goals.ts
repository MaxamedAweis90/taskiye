import { Router, Response } from 'express';
import { Goal, GoalTargetType } from '../models/Goal.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/**
 * GET /api/goals
 * List all active goals for the user
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendSuccess(res, [], 'Guest mode: no remote goals');
    }

    const { targetType, isCompleted } = req.query;
    const filter: Record<string, unknown> = { userId: req.user.id };

    if (targetType && typeof targetType === 'string') {
      filter.targetType = targetType;
    }

    if (typeof isCompleted === 'string') {
      filter.isCompleted = isCompleted === 'true';
    }

    const goals = await Goal.find(filter).sort({ deadline: 1, createdAt: -1 });
    return sendSuccess(res, goals);
  } catch (error) {
    return sendError(res, 'Failed to fetch goals', 500, error);
  }
});

/**
 * POST /api/goals
 * Create a new goal with strict deadline and targetType
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, deadline, targetType } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return sendError(res, 'Goal title is required', 400);
    }

    if (!deadline) {
      return sendError(res, 'Goal deadline is required', 400);
    }

    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      return sendError(res, 'Invalid deadline date format', 400);
    }

    const validTargetTypes: GoalTargetType[] = ['weekly', 'yearly', 'custom'];
    if (!targetType || !validTargetTypes.includes(targetType)) {
      return sendError(
        res,
        'Invalid targetType (must be one of: weekly, yearly, custom)',
        400
      );
    }

    const goal = await Goal.create({
      userId: req.user!.id,
      title: title.trim(),
      deadline: parsedDeadline,
      targetType,
      isCompleted: false,
    });

    return sendSuccess(res, goal, 'Goal created successfully', 201);
  } catch (error) {
    return sendError(res, 'Failed to create goal', 500, error);
  }
});

/**
 * PATCH /api/goals/:id
 * Toggle completion or update goal details
 */
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, deadline, targetType, isCompleted } = req.body;

    const updateFields: Record<string, unknown> = {};
    if (typeof title === 'string' && title.trim()) updateFields.title = title.trim();
    if (typeof isCompleted === 'boolean') updateFields.isCompleted = isCompleted;

    if (deadline) {
      const parsedDeadline = new Date(deadline);
      if (!isNaN(parsedDeadline.getTime())) updateFields.deadline = parsedDeadline;
    }

    if (targetType && ['weekly', 'yearly', 'custom'].includes(targetType)) {
      updateFields.targetType = targetType;
    }

    const goal = await Goal.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $set: updateFields },
      { new: true }
    );

    if (!goal) {
      return sendError(res, 'Goal not found or unauthorized', 404);
    }

    return sendSuccess(res, goal, 'Goal updated successfully');
  } catch (error) {
    return sendError(res, 'Failed to update goal', 500, error);
  }
});

/**
 * DELETE /api/goals/:id
 * Delete a goal
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const goal = await Goal.findOneAndDelete({ _id: id, userId: req.user!.id });
    if (!goal) {
      return sendError(res, 'Goal not found or unauthorized', 404);
    }

    return sendSuccess(res, { id }, 'Goal deleted successfully');
  } catch (error) {
    return sendError(res, 'Failed to delete goal', 500, error);
  }
});

export default router;
