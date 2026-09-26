import { Habit, IHabit } from '../models/Habit.js';
import { Router, Response } from 'express';
import { Task } from '../models/Task.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { invalidateRankingsCache } from './rankings.js';

const router = Router();

// warnings: 0 = safe, 1–2 = at-risk days missed, reset to 0 on 3 missed scheduled days
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

  // Habits with 0 streak, no completions, or no completion date NEVER have warnings or freeze
  if (!habit.streakDays || habit.streakDays <= 0 || !habit.lastCompletedDate || (habit.totalCompletions ?? 0) <= 0) {
    return {
      streakDays: 0,
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
      warnings: 1, // Warning 1: Streak frozen / 1 strike used
    };
  } else if (missedCount === 2) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 2, // Warning 2: Final notice / 2 strikes used
    };
  } else {
    // 3 or more consecutive missed scheduled days: streak resets to 0 and warnings clear
    return {
      streakDays: 0,
      warnings: 0,
    };
  }
}

// Calculate consistency rate based on scheduled days vs completed days over the past 7 days
export function calculateHabitConsistency(
  habit: Partial<IHabit>,
  todayStr: string
): number {
  if (!habit.totalCompletions || habit.totalCompletions <= 0) {
    return 0;
  }

  const activeDays: number[] =
    Array.isArray(habit.activeDays) && habit.activeDays.length > 0
      ? habit.activeDays
      : [0, 1, 2, 3, 4, 5, 6];

  const completedSet = new Set<string>(habit.completedDates || []);
  if (habit.lastCompletedDate) {
    completedSet.add(habit.lastCompletedDate);
  }

  // Backfill completed dates using active streak history leading up to lastCompletedDate
  const streak = habit.streakDays ?? 0;
  if (streak > 1 && habit.lastCompletedDate) {
    const lastDate = new Date(habit.lastCompletedDate + 'T00:00:00Z');
    if (!isNaN(lastDate.getTime())) {
      const backCursor = new Date(lastDate);
      let countAdded = 1;
      for (let d = 1; d <= 30 && countAdded < streak; d++) {
        backCursor.setUTCDate(backCursor.getUTCDate() - 1);
        const jsDay = backCursor.getUTCDay();
        const monBased = (jsDay + 6) % 7;
        if (activeDays.includes(monBased)) {
          completedSet.add(backCursor.toISOString().slice(0, 10));
          countAdded++;
        }
      }
    }
  }

  const today = new Date(todayStr + 'T00:00:00Z');
  let scheduledCount = 0;
  let completedCount = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const jsDay = d.getUTCDay();
    const monBased = (jsDay + 6) % 7; // Mon: 0 ... Sun: 6

    if (activeDays.includes(monBased)) {
      scheduledCount++;
      const dateStr = d.toISOString().slice(0, 10);
      if (completedSet.has(dateStr)) {
        completedCount++;
      }
    }
  }

  if (scheduledCount === 0) {
    return habit.totalCompletions > 0 ? 100 : 0;
  }

  return Math.min(100, Math.round((completedCount / scheduledCount) * 100));
}

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

    // Slice completedDates to the most recent 30 entries to prevent memory and payload bloat
    const habits = await Habit.find(filter, { completedDates: { $slice: -30 } }).sort({ sortOrder: 1, createdAt: -1 });

    const todayStr = new Date().toISOString().slice(0, 10);
    const evaluatedHabits = await Promise.all(
      habits.map(async (h) => {
        if (!h.isArchived) {
          const { streakDays, warnings } = evaluateHabitStreakAndWarnings(h, todayStr);
          const consistencyRate = calculateHabitConsistency(h, todayStr);
          const needsUpdate =
            h.streakDays !== streakDays ||
            h.warnings !== warnings ||
            h.consistencyRate !== consistencyRate;

          if (needsUpdate) {
            h.streakDays = streakDays;
            h.warnings = warnings;
            h.consistencyRate = consistencyRate;
            await Habit.updateOne({ _id: h._id }, { $set: { streakDays, warnings, consistencyRate } });
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

    await Habit.bulkWrite(bulkOps);

    return sendSuccess(res, { updatedCount: items.length }, 'Habits reordered successfully');
  } catch (error) {
    return sendError(res, 'Failed to batch reorder habits', 500, error);
  }
});

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, category, frequency, timeOfDay, targetUnit, activeDays } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return sendError(res, 'Habit title is required', 400);
    }

    const lastHabit = await Habit.findOne({ userId: req.user!.id, deletedAt: null })
      .sort({ sortOrder: -1 })
      .select('sortOrder');
    const nextSortOrder = (lastHabit?.sortOrder ?? -1) + 1;

    const habit = await Habit.create({
      userId: req.user!.id,
      title: title.trim(),
      category: category?.trim() || 'Routine',
      frequency: frequency?.trim() || 'Daily',
      timeOfDay: timeOfDay?.trim() || 'Morning (08:00 AM)',
      targetUnit: targetUnit?.trim() || 'sessions',
      activeDays: Array.isArray(activeDays) ? activeDays : [0, 1, 2, 3, 4, 5, 6],
      sortOrder: nextSortOrder,
      streakDays: 0,
      totalCompletions: 0,
      warnings: 0,
      isArchived: false,
      consistencyRate: 0,
    });

    return sendSuccess(res, habit, 'Habit created successfully', 201);
  } catch (error) {
    return sendError(res, 'Failed to create habit', 500, error);
  }
});

router.get('/trash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const trashedHabits = await Habit.find({
      userId: req.user!.id,
      deletedAt: { $ne: null },
    })
      .sort({ deletedAt: -1 })
      .limit(100);

    return sendSuccess(res, trashedHabits, 'Trashed habits fetched successfully');
  } catch (error) {
    return sendError(res, 'Failed to fetch trashed habits', 500, error);
  }
});

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
        updateFields.frozenAt = new Date();
        updateFields.lastStreak = existing.streakDays;
      } else {
        // Resuming from freeze / vacation mode: clear warnings and preserve or offset last completed
        updateFields.frozenAt = null;
        updateFields.warnings = 0;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        // Only set lastCompletedDate to yesterday if current lastCompletedDate is older than yesterday
        if (!existing.lastCompletedDate || existing.lastCompletedDate < yStr) {
          updateFields.lastCompletedDate = yStr;
        }
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

router.post('/:id/toggle', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isCompleted } = req.body as { isCompleted?: boolean };

    const habit = await Habit.findOne({ _id: id, userId: req.user!.id });
    if (!habit) {
      return sendError(res, 'Habit not found or unauthorized', 404);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const isAlreadyCompletedToday = Boolean(
      habit.completedDates?.includes(todayStr) || habit.lastCompletedDate === todayStr
    );
    const willBeCompleted =
      typeof isCompleted === 'boolean' ? isCompleted : !isAlreadyCompletedToday;

    let updatedHabit;
    if (willBeCompleted) {
      // Completed: only increment streak if not already completed today
      const nextStreak = isAlreadyCompletedToday ? (habit.streakDays || 0) : (habit.streakDays || 0) + 1;
      const nextCompletions = isAlreadyCompletedToday ? (habit.totalCompletions || 0) : (habit.totalCompletions || 0) + 1;

      const nextDates = Array.from(new Set([...(habit.completedDates || []), todayStr]));
      const nextConsistency = calculateHabitConsistency(
        {
          ...habit.toObject(),
          totalCompletions: nextCompletions,
          lastCompletedDate: todayStr,
          completedDates: nextDates,
        },
        todayStr
      );

      updatedHabit = await Habit.findOneAndUpdate(
        { _id: id, userId: req.user!.id },
        {
          $set: {
            streakDays: nextStreak,
            totalCompletions: nextCompletions,
            consistencyRate: nextConsistency,
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
      // Uncompleted: remove todayStr from completedDates, derive new lastCompletedDate, recalculate streak & warnings
      const remainingDates = (habit.completedDates || []).filter((d) => d !== todayStr).sort();
      const newLastCompletedDate = remainingDates.length > 0 ? remainingDates[remainingDates.length - 1] : null;
      const nextCompletions = Math.max(0, (habit.totalCompletions || 0) - 1);
      const baseStreak = Math.max(0, (habit.streakDays || 0) - (isAlreadyCompletedToday ? 1 : 0));

      const evalResult = evaluateHabitStreakAndWarnings(
        {
          ...habit.toObject(),
          lastCompletedDate: newLastCompletedDate,
          streakDays: baseStreak,
          completedDates: remainingDates,
          totalCompletions: nextCompletions,
        },
        todayStr
      );

      const nextConsistency = calculateHabitConsistency(
        {
          ...habit.toObject(),
          totalCompletions: nextCompletions,
          lastCompletedDate: newLastCompletedDate,
          completedDates: remainingDates,
        },
        todayStr
      );

      updatedHabit = await Habit.findOneAndUpdate(
        { _id: id, userId: req.user!.id },
        {
          $set: {
            streakDays: evalResult.streakDays,
            warnings: evalResult.warnings,
            totalCompletions: nextCompletions,
            consistencyRate: nextConsistency,
            lastCompletedDate: newLastCompletedDate,
            isArchived: false, // Ensure NEVER archived!
          },
          $pull: {
            completedDates: todayStr,
          },
        },
        { new: true }
      );
    }

    invalidateRankingsCache();

    return sendSuccess(res, updatedHabit, 'Habit completion updated');
  } catch (error) {
    return sendError(res, 'Failed to toggle habit completion', 500, error);
  }
});

export default router;
