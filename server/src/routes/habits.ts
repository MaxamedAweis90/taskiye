import { Habit, IHabit } from '../models/Habit.js';
import { Router, Response } from 'express';
import { Task } from '../models/Task.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/**
 * Calculates current streak and warning buffer (0, 1, 2, or reset to 0)
 * based on missed scheduled days since lastCompletedDate.
 */
export function evaluateHabitStreakAndWarnings(
  habit: Partial<IHabit>,
  todayStr: string
): { streakDays: number; warnings: number } {
  if (habit.isArchived || habit.isStreakFrozen) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: habit.warnings ?? 0,
    };
  }

  if (!habit.lastCompletedDate) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 0,
    };
  }

  if (habit.lastCompletedDate === todayStr) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 0,
    };
  }

  const lastDate = new Date(habit.lastCompletedDate + 'T00:00:00Z');
  const today = new Date(todayStr + 'T00:00:00Z');

  if (isNaN(lastDate.getTime()) || isNaN(today.getTime()) || lastDate >= today) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 0,
    };
  }

  const activeDays: number[] =
    Array.isArray(habit.activeDays) && habit.activeDays.length > 0
      ? habit.activeDays
      : [0, 1, 2, 3, 4, 5, 6];

  let missedCount = 0;
  const cursor = new Date(lastDate);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (cursor < today) {
    const jsDay = cursor.getUTCDay();
    const monBased = (jsDay + 6) % 7; // Mon: 0 ... Sun: 6
    if (activeDays.includes(monBased)) {
      missedCount++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (missedCount === 0) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 0,
    };
  } else if (missedCount === 1) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 1, // Warning 1: Streak frozen
    };
  } else if (missedCount === 2) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 2, // Warning 2: Streak frozen
    };
  } else {
    // 3 or more consecutive missed days: streak resets to 0
    return {
      streakDays: 0,
      warnings: 0,
    };
  }
}

/**
 * GET /api/habits
 * Fetch active habits for the authenticated user (with real-time streak & warning evaluation)
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendSuccess(res, [], 'Guest mode: no remote habits');
    }

    const includeArchived = req.query.includeArchived === 'true';
    const filter: Record<string, unknown> = {
      userId: req.user.id,
      deletedAt: null,
    };

    if (!includeArchived) {
      filter.isArchived = false;
    }

    const habits = await Habit.find(filter).sort({ createdAt: -1 });

    const todayStr = new Date().toISOString().slice(0, 10);
    const evaluatedHabits = await Promise.all(
      habits.map(async (h) => {
        if (!h.isArchived) {
          const { streakDays, warnings } = evaluateHabitStreakAndWarnings(h, todayStr);
          if (h.streakDays !== streakDays || h.warnings !== warnings) {
            h.streakDays = streakDays;
            h.warnings = warnings;
            await Habit.updateOne({ _id: h._id }, { $set: { streakDays, warnings } });
          }
        }
        return h;
      })
    );

    return sendSuccess(res, evaluatedHabits);
  } catch (error) {
    return sendError(res, 'Failed to fetch habits', 500, error);
  }
});

/**
 * POST /api/habits
 * Create a new habit
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, category, frequency, timeOfDay, targetUnit, activeDays } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return sendError(res, 'Habit title is required', 400);
    }

    const habit = await Habit.create({
      userId: req.user!.id,
      title: title.trim(),
      category: category?.trim() || 'Routine',
      frequency: frequency?.trim() || 'Daily',
      timeOfDay: timeOfDay?.trim() || 'Morning (08:00 AM)',
      targetUnit: targetUnit?.trim() || 'sessions',
      activeDays: Array.isArray(activeDays) ? activeDays : [0, 1, 2, 3, 4, 5, 6],
      streakDays: 0,
      totalCompletions: 0,
      warnings: 0,
      isArchived: false,
      consistencyRate: 100,
    });

    return sendSuccess(res, habit, 'Habit created successfully', 201);
  } catch (error) {
    return sendError(res, 'Failed to create habit', 500, error);
  }
});

/**
 * GET /api/habits/trash
 * Fetch all soft-deleted habits for the authenticated user (within 30-day retention window)
 */
router.get('/trash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const trashedHabits = await Habit.find({
      userId: req.user!.id,
      deletedAt: { $ne: null },
    }).sort({ deletedAt: -1 });

    return sendSuccess(res, trashedHabits, 'Trashed habits fetched successfully');
  } catch (error) {
    return sendError(res, 'Failed to fetch trashed habits', 500, error);
  }
});

/**
 * DELETE /api/habits/trash/empty
 * Permanently purge all soft-deleted habits and cascade delete associated habit instance tasks
 */
router.delete('/trash/empty', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const trashed = await Habit.find({
      userId: req.user!.id,
      deletedAt: { $ne: null },
    });

    const trashedIds = trashed.map((h) => h._id);
    const trashedTitles = trashed.map((h) => h.title);

    // Cascade hard-delete habit documents
    const habitResult = await Habit.deleteMany({
      _id: { $in: trashedIds },
      userId: req.user!.id,
    });

    // Cascade hard-delete linked habit task instances
    await Task.deleteMany({
      userId: req.user!.id,
      $or: [
        { habitId: { $in: trashedIds } },
        { isHabitInstance: true, title: { $in: trashedTitles } },
      ],
    });

    return sendSuccess(res, { deletedCount: habitResult.deletedCount }, 'Habits trash emptied and cascade purged');
  } catch (error) {
    return sendError(res, 'Failed to empty habits trash', 500, error);
  }
});

/**
 * POST /api/habits/:id/restore
 * Restore a soft-deleted habit from trash back to active
 */
router.post('/:id/restore', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const habit = await Habit.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $set: { deletedAt: null } },
      { new: true }
    );

    if (!habit) {
      return sendError(res, 'Habit not found or unauthorized', 404);
    }

    // Also un-delete any soft-deleted task instances linked to this habit
    await Task.updateMany(
      {
        userId: req.user!.id,
        $or: [{ habitId: id }, { isHabitInstance: true, title: habit.title }],
        deletedAt: { $ne: null },
      },
      { $set: { deletedAt: null } }
    );

    return sendSuccess(res, habit, 'Habit restored successfully');
  } catch (error) {
    return sendError(res, 'Failed to restore habit', 500, error);
  }
});

/**
 * DELETE /api/habits/:id
 * Soft-delete habit to 30-day trash, or permanent hard-delete with cascade if ?permanent=true
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isPermanent = req.query.permanent === 'true';

    const existingHabit = await Habit.findOne({ _id: id, userId: req.user!.id });
    if (!existingHabit) {
      return sendError(res, 'Habit not found or unauthorized', 404);
    }

    if (isPermanent) {
      // Cascade permanent delete: delete habit document + all linked task instances
      await Habit.deleteOne({ _id: id, userId: req.user!.id });
      await Task.deleteMany({
        userId: req.user!.id,
        $or: [{ habitId: id }, { isHabitInstance: true, title: existingHabit.title }],
      });
      return sendSuccess(res, { id, permanent: true }, 'Habit and linked tasks permanently deleted');
    }

    // Soft-delete habit with 30-day TTL recovery window
    const habit = await Habit.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      {
        $set: {
          deletedAt: new Date(),
          lastStreak: existingHabit.streakDays,
        },
      },
      { new: true }
    );

    // Soft-delete all associated daily tasks
    await Task.updateMany(
      {
        userId: req.user!.id,
        $or: [{ habitId: id }, { isHabitInstance: true, title: existingHabit.title }],
        deletedAt: null,
      },
      { $set: { deletedAt: new Date() } }
    );

    return sendSuccess(res, habit, 'Habit moved to trash (30-day retention)');
  } catch (error) {
    return sendError(res, 'Failed to delete habit', 500, error);
  }
});

/**
 * PATCH /api/habits/:id
 * Update an existing habit or restore from archive
 */
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, category, frequency, timeOfDay, targetUnit, activeDays, isArchived, isStreakFrozen } = req.body;

    const existing = await Habit.findOne({ _id: id, userId: req.user!.id });
    if (!existing) {
      return sendError(res, 'Habit not found or unauthorized', 404);
    }

    const updateFields: Record<string, unknown> = {};
    if (typeof title === 'string' && title.trim()) updateFields.title = title.trim();
    if (typeof category === 'string' && category.trim()) updateFields.category = category.trim();
    if (typeof frequency === 'string') updateFields.frequency = frequency.trim();
    if (typeof timeOfDay === 'string') updateFields.timeOfDay = timeOfDay.trim();
    if (typeof targetUnit === 'string') updateFields.targetUnit = targetUnit.trim();
    if (Array.isArray(activeDays)) updateFields.activeDays = activeDays;

    if (typeof isStreakFrozen === 'boolean') {
      updateFields.isStreakFrozen = isStreakFrozen;
      if (isStreakFrozen) {
        updateFields.lastStreak = existing.streakDays;
      } else {
        // Resuming from freeze / vacation mode: clear warnings and offset last completed
        updateFields.warnings = 0;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        updateFields.lastCompletedDate = yesterday.toISOString().slice(0, 10);
      }
    }

    if (typeof isArchived === 'boolean') {
      updateFields.isArchived = isArchived;
      if (!isArchived) {
        // Restoring habit: resume from preserved streak & clear archive timestamp
        updateFields.archivedAt = null;
        updateFields.warnings = 0;
        if (existing.lastStreak && existing.lastStreak > 0) {
          updateFields.streakDays = existing.lastStreak;
        }
        // Offset lastCompletedDate so days in archive do NOT count as missed
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        updateFields.lastCompletedDate = yesterday.toISOString().slice(0, 10);
      } else {
        // Archiving
        updateFields.archivedAt = new Date();
        updateFields.lastStreak = existing.streakDays;

        // Clean up task instances when archiving via PATCH
        await Task.deleteMany({
          userId: req.user!.id,
          $or: [{ habitId: id }, { isHabitInstance: true, title: existing.title }],
        });
      }
    }

    const habit = await Habit.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $set: updateFields },
      { new: true }
    );

    // Cascade category, title, timeOfDay updates to linked Task instances
    if (updateFields.category || updateFields.title || updateFields.timeOfDay) {
      const taskUpdates: Record<string, unknown> = {};
      if (updateFields.category) taskUpdates.category = updateFields.category;
      if (updateFields.title) taskUpdates.title = updateFields.title;
      if (updateFields.timeOfDay) taskUpdates.timeTag = updateFields.timeOfDay;

      await Task.updateMany(
        {
          userId: req.user!.id,
          $or: [{ habitId: id }, { isHabitInstance: true, title: existing.title }],
        },
        { $set: taskUpdates }
      );
    }

    return sendSuccess(res, habit, 'Habit updated successfully');
  } catch (error) {
    return sendError(res, 'Failed to update habit', 500, error);
  }
});

/**
 * POST /api/habits/:id/toggle
 * Toggle habit completion state for today (from Overview or Habit Manager)
 * Increments or decrements completion count and streak, updates warnings.
 * Persists historical completedDates array.
 * NEVER archives the habit.
 */
router.post('/:id/toggle', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isCompleted } = req.body as { isCompleted?: boolean };

    const habit = await Habit.findOne({ _id: id, userId: req.user!.id });
    if (!habit) {
      return sendError(res, 'Habit not found or unauthorized', 404);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const willBeCompleted =
      typeof isCompleted === 'boolean' ? isCompleted : habit.lastCompletedDate !== todayStr;

    let updatedHabit;
    if (willBeCompleted) {
      // Completed: only increment streak if not already completed today
      const isAlreadyCompletedToday = habit.lastCompletedDate === todayStr;
      const nextStreak = isAlreadyCompletedToday ? (habit.streakDays || 0) : (habit.streakDays || 0) + 1;
      const nextCompletions = isAlreadyCompletedToday ? (habit.totalCompletions || 0) : (habit.totalCompletions || 0) + 1;

      updatedHabit = await Habit.findOneAndUpdate(
        { _id: id, userId: req.user!.id },
        {
          $set: {
            streakDays: nextStreak,
            totalCompletions: nextCompletions,
            warnings: 0,
            lastCompletedDate: todayStr,
            isArchived: false, // Ensure NEVER archived!
          },
          $addToSet: {
            completedDates: todayStr,
          },
        },
        { new: true }
      );
    } else {
      // Uncompleted: -1 total completions, -1 streak (floor at 0), remove from completedDates
      const nextStreak = Math.max(0, (habit.streakDays || 0) - 1);
      const nextCompletions = Math.max(0, (habit.totalCompletions || 0) - 1);

      updatedHabit = await Habit.findOneAndUpdate(
        { _id: id, userId: req.user!.id },
        {
          $set: {
            streakDays: nextStreak,
            totalCompletions: nextCompletions,
            lastCompletedDate: null,
            isArchived: false, // Ensure NEVER archived!
          },
          $pull: {
            completedDates: todayStr,
          },
        },
        { new: true }
      );
    }

    return sendSuccess(res, updatedHabit, 'Habit completion updated');
  } catch (error) {
    return sendError(res, 'Failed to toggle habit completion', 500, error);
  }
});

export default router;
