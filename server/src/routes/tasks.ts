import { Router, Response } from 'express';
import { Task } from '../models/Task.js';
import { Habit } from '../models/Habit.js';
import { evaluateHabitStreakAndWarnings, calculateHabitConsistency } from './habits.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { invalidateRankingsCache } from './rankings.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { dispatchUnifiedNotification } from '../lib/push.js';

const router = Router();

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

router.get('/activity', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendSuccess(res, {}, 'Guest mode: no remote activity');
    }

    const userId = req.user.id;

    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    oneYearAgo.setUTCHours(0, 0, 0, 0);

    const taskStats = await Task.aggregate<{
      _id: string;
      totalCount: number;
      completedCount: number;
    }>([
      {
        $match: {
          userId,
          deletedAt: null,
          date: { $gte: oneYearAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalCount: { $sum: 1 },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] },
          },
        },
      },
    ]);

    const activityMap: Record<string, { completedCount: number; totalCount: number }> = {};
    for (const stat of taskStats) {
      if (stat._id) {
        activityMap[stat._id] = {
          completedCount: stat.completedCount,
          totalCount: stat.totalCount,
        };
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

// Categories: 'Work' | 'Health & Fitness' | 'Routine Activity' | 'Mind Improving' | 'Personal Growth'
function normalizeTaskCategory(cat?: string | null): string {
  if (!cat) return 'Work';
  const lower = cat.toLowerCase().trim();
  if (lower.includes('health') || lower.includes('fitness')) return 'Health & Fitness';
  if (lower.includes('routine')) return 'Routine Activity';
  if (
    lower.includes('mind') ||
    lower.includes('reading') ||
    lower.includes('read') ||
    lower.includes('learn') ||
    lower.includes('study') ||
    lower.includes('focus')
  ) {
    return 'Mind Improving';
  }
  if (
    lower.includes('growth') ||
    lower.includes('personal') ||
    lower.includes('goal') ||
    lower.includes('habit')
  ) {
    return 'Personal Growth';
  }
  return 'Work';
}

router.get('/history', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendSuccess(res, {
        days: [],
        nextCursorDate: null,
        hasMore: false,
        totalLoggedCount: 0,
      });
    }

    const userId = req.user.id;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const cursorDate = (req.query.cursorDate as string) || todayStr;
    const isInitialPage = !req.query.cursorDate;
    const daysCount = Math.max(1, Math.min(30, parseInt((req.query.days as string) || '14', 10)));
    const searchFilter = ((req.query.search as string) || '').trim().toLowerCase();
    const categoryFilter = ((req.query.category as string) || '').trim();
    const hideCompleted = req.query.hideCompleted === 'true';

    // Parse cursor date (endDate of the window)
    const endDate = new Date(cursorDate + 'T23:59:59.999Z');
    if (isNaN(endDate.getTime())) {
      return sendError(res, 'Invalid cursorDate format (expected YYYY-MM-DD)', 400);
    }

    // Calculate startDate of the window (daysCount days prior)
    const startDate = new Date(cursorDate + 'T00:00:00.000Z');
    startDate.setUTCDate(startDate.getUTCDate() - (daysCount - 1));

    // Base filter: STRICTLY standalone tasks, never habit instances!
    const baseHistoryFilter = {
      userId,
      deletedAt: null,
      isHabitInstance: { $ne: true },
      habitId: null,
    };

    const todayEnd = new Date(todayStr + 'T23:59:59.999Z');

    const [tasks, upcomingTasksRaw, totalLoggedCount, earlierCount] = await Promise.all([
      Task.find({
        ...baseHistoryFilter,
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: -1, sortOrder: 1, createdAt: 1 }),
      isInitialPage
        ? Task.find({
            ...baseHistoryFilter,
            date: { $gt: todayEnd },
          }).sort({ date: 1, sortOrder: 1, createdAt: 1 })
        : Promise.resolve([]),
      Task.countDocuments(baseHistoryFilter),
      Task.countDocuments({ ...baseHistoryFilter, date: { $lt: startDate } }),
    ]);

    // Group tasks by date string (YYYY-MM-DD)
    const tasksByDate = new Map<string, typeof tasks>();
    for (const t of tasks) {
      if (!t.date) continue;
      const dStr = new Date(t.date).toISOString().slice(0, 10);
      if (!tasksByDate.has(dStr)) {
        tasksByDate.set(dStr, []);
      }
      tasksByDate.get(dStr)!.push(t);
    }

    // Generate day buckets in descending order from cursorDate down to startDate
    interface HistoryTaskItem {
      id: string;
      title: string;
      isCompleted: boolean;
      category: string;
      priority: 'normal' | 'high';
      timeTag: string | null;
      isHabitInstance: boolean;
      habitId: unknown;
      status: 'completed' | 'pending' | 'missed';
      date: string;
      createdAt: string;
    }

    interface HistoryDayBucket {
      date: string;
      label: string;
      formattedDate: string;
      isTomorrow: boolean;
      isToday: boolean;
      isYesterday: boolean;
      tasks: HistoryTaskItem[];
      totalCount: number;
      completedCount: number;
      completionPercentage: number;
    }

    const dayBuckets: HistoryDayBucket[] = [];
    const loopDate = new Date(endDate);

    for (let i = 0; i < daysCount; i++) {
      const dStr = loopDate.toISOString().slice(0, 10);
      const isTomorrow = dStr === tomorrowStr;
      const isToday = dStr === todayStr;
      const isYesterday = dStr === yesterdayStr;

      // Label generation
      const label = isTomorrow
        ? 'TOMORROW'
        : isToday
        ? 'TODAY'
        : isYesterday
        ? 'YESTERDAY'
        : loopDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          }).toUpperCase();

      // Formatted date string (e.g. "Thursday, Oct 15, 2026")
      const formattedDate = isTomorrow || isToday || isYesterday
        ? loopDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          })
        : loopDate.toLocaleDateString('en-US', {
            weekday: 'long',
            timeZone: 'UTC',
          });

      const rawDayTasks = tasksByDate.get(dStr) || [];
      const totalCount = rawDayTasks.length;
      const completedCount = rawDayTasks.filter((t) => t.isCompleted).length;
      const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      // Filter and map tasks
      const dayTasks: HistoryTaskItem[] = rawDayTasks
        .filter((t) => {
          if (hideCompleted && t.isCompleted) return false;
          const normalizedCat = normalizeTaskCategory(t.category);
          if (categoryFilter && categoryFilter !== 'All Categories' && normalizedCat !== categoryFilter) {
            return false;
          }
          if (searchFilter) {
            const matchTitle = (t.title || '').toLowerCase().includes(searchFilter);
            const matchCat = normalizedCat.toLowerCase().includes(searchFilter);
            if (!matchTitle && !matchCat) return false;
          }
          return true;
        })
        .map((t) => {
          let status: 'completed' | 'pending' | 'missed' = 'pending';
          if (t.isCompleted) {
            status = 'completed';
          } else if (dStr < todayStr) {
            status = 'missed';
          } else {
            status = 'pending';
          }

          return {
            id: t._id.toString(),
            title: t.title,
            isCompleted: t.isCompleted,
            category: normalizeTaskCategory(t.category),
            priority: (t.priority as 'normal' | 'high') || 'normal',
            timeTag: t.timeTag || null,
            isHabitInstance: false,
            habitId: null,
            status,
            date: dStr,
            createdAt: t.createdAt.toISOString(),
          };
        });

      // Only include day buckets that have tasks or are Tomorrow/Today
      if (dayTasks.length > 0 || isTomorrow || isToday) {
        dayBuckets.push({
          date: dStr,
          label,
          formattedDate,
          isTomorrow,
          isToday,
          isYesterday,
          tasks: dayTasks,
          totalCount,
          completedCount,
          completionPercentage,
        });
      }

      // Step back 1 day
      loopDate.setUTCDate(loopDate.getUTCDate() - 1);
    }

    const nextCursor = new Date(startDate);
    nextCursor.setUTCDate(nextCursor.getUTCDate() - 1);
    const nextCursorDate = earlierCount > 0 ? nextCursor.toISOString().slice(0, 10) : null;

    // Filter and map upcoming tasks
    const mappedUpcomingTasks: HistoryTaskItem[] = upcomingTasksRaw
      .filter((t) => {
        if (hideCompleted && t.isCompleted) return false;
        const normalizedCat = normalizeTaskCategory(t.category);
        if (categoryFilter && categoryFilter !== 'All Categories' && normalizedCat !== categoryFilter) {
          return false;
        }
        if (searchFilter) {
          const matchTitle = (t.title || '').toLowerCase().includes(searchFilter);
          const matchCat = normalizedCat.toLowerCase().includes(searchFilter);
          if (!matchTitle && !matchCat) return false;
        }
        return true;
      })
      .map((t) => ({
        id: t._id.toString(),
        title: t.title,
        isCompleted: t.isCompleted,
        category: normalizeTaskCategory(t.category),
        priority: (t.priority as 'normal' | 'high') || 'normal',
        timeTag: t.timeTag || null,
        isHabitInstance: false,
        habitId: null,
        status: t.isCompleted ? 'completed' : 'pending',
        date: new Date(t.date).toISOString().slice(0, 10),
        createdAt: t.createdAt.toISOString(),
      }));

    return sendSuccess(res, {
      upcomingTasks: mappedUpcomingTasks,
      days: dayBuckets,
      nextCursorDate,
      hasMore: earlierCount > 0,
      totalLoggedCount,
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch task history', 500, error);
  }
});

router.post('/:id/reschedule', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { targetDate } = req.body as { targetDate?: string };

    const originalTask = await Task.findOne({
      _id: id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!originalTask) {
      return sendError(res, 'Original task not found', 404);
    }

    // Resolve target date object
    const now = new Date();
    let targetDateObj: Date;

    if (!targetDate || targetDate === 'today') {
      targetDateObj = new Date(now.toISOString().slice(0, 10) + 'T12:00:00.000Z');
    } else if (targetDate === 'tomorrow') {
      const tom = new Date(now.getTime() + 86400000);
      targetDateObj = new Date(tom.toISOString().slice(0, 10) + 'T12:00:00.000Z');
    } else {
      const parsed = new Date(targetDate + 'T12:00:00.000Z');
      if (isNaN(parsed.getTime())) {
        return sendError(res, 'Invalid targetDate format (expected YYYY-MM-DD)', 400);
      }
      targetDateObj = parsed;
    }

    const todayStr = now.toISOString().slice(0, 10);
    const origDateStr = originalTask.date
      ? new Date(originalTask.date).toISOString().slice(0, 10)
      : todayStr;

    // Previous / past missed tasks (strictly before today) are retained as historical records (copied only).
    // Active tasks scheduled for Today, Tomorrow, or future are moved (deleted from original date).
    const isPastTask = origDateStr < todayStr;
    const shouldDeleteOriginal = !isPastTask;

    if (shouldDeleteOriginal) {
      await Task.deleteOne({ _id: originalTask._id, userId: req.user!.id });
    }

    // Create a new task instance on the target date
    const newTask = await Task.create({
      userId: req.user!.id,
      title: originalTask.title,
      category: originalTask.category || 'Work',
      priority: originalTask.priority || 'normal',
      timeTag: originalTask.timeTag || null,
      isHabitInstance: false,
      habitId: originalTask.habitId || null,
      isCompleted: false,
      date: targetDateObj,
      sortOrder: 0,
    });

    return sendSuccess(
      res,
      {
        originalTaskId: originalTask._id,
        originalTaskDate: origDateStr,
        wasMoved: shouldDeleteOriginal,
        newTask,
      },
      shouldDeleteOriginal ? 'Task moved to target schedule' : 'Task copied to target schedule',
      201
    );
  } catch (error) {
    return sendError(res, 'Failed to reschedule task', 500, error);
  }
});

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, date, sortOrder, isHabitInstance, habitId, isCompleted, category, priority, timeTag } = req.body;

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
            const isAlreadyCompletedToday = Boolean(
              linkedHabit?.completedDates?.includes(todayStr) || linkedHabit?.lastCompletedDate === todayStr
            );
            await Habit.findOneAndUpdate(
              { _id: habitId, userId: req.user!.id },
              {
                $inc: {
                  totalCompletions: isAlreadyCompletedToday ? 0 : 1,
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
      category: category || 'Work',
      priority: priority || 'normal',
      timeTag: timeTag || null,
    });

    // If a completed habit instance is created, update the habit counters (+1 completion, streak if not already done today, 0 warnings, completedDates)
    if (task.isHabitInstance && task.habitId && task.isCompleted) {
      const todayStr = taskDate.toISOString().slice(0, 10);
      const linkedHabit = await Habit.findOne({ _id: task.habitId, userId: req.user!.id });
      const isAlreadyCompletedToday = Boolean(
        linkedHabit?.completedDates?.includes(todayStr) || linkedHabit?.lastCompletedDate === todayStr
      );
      await Habit.findOneAndUpdate(
        { _id: task.habitId, userId: req.user!.id },
        {
          $inc: {
            totalCompletions: isAlreadyCompletedToday ? 0 : 1,
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

router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isCompleted, title, date, sortOrder, category, priority, timeTag } = req.body;

    const updateFields: Record<string, unknown> = {};
    if (typeof isCompleted === 'boolean') updateFields.isCompleted = isCompleted;
    if (typeof title === 'string' && title.trim()) updateFields.title = title.trim();
    if (typeof sortOrder === 'number') updateFields.sortOrder = sortOrder;
    if (typeof category === 'string') updateFields.category = category.trim();
    if (priority === 'normal' || priority === 'high') updateFields.priority = priority;
    if (timeTag !== undefined) updateFields.timeTag = timeTag;
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
        const isAlreadyCompletedToday = Boolean(
          linkedHabit?.completedDates?.includes(taskDateStr) || linkedHabit?.lastCompletedDate === taskDateStr
        );
        const nextCompletions = (linkedHabit?.totalCompletions || 0) + (isAlreadyCompletedToday ? 0 : 1);
        const nextDates = Array.from(new Set([...(linkedHabit?.completedDates || []), taskDateStr]));
        const nextConsistency = calculateHabitConsistency(
          {
            ...linkedHabit?.toObject(),
            totalCompletions: nextCompletions,
            lastCompletedDate: taskDateStr,
            completedDates: nextDates,
          },
          taskDateStr
        );

        await Habit.findOneAndUpdate(
          { _id: task.habitId, userId: req.user!.id },
          {
            $inc: {
              totalCompletions: isAlreadyCompletedToday ? 0 : 1,
              streakDays: isAlreadyCompletedToday ? 0 : 1,
            },
            $set: { warnings: 0, consistencyRate: nextConsistency, lastCompletedDate: taskDateStr, isArchived: false },
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
            const wasAlreadyCompleted = Boolean(
              linkedHabit.completedDates?.includes(taskDateStr) || linkedHabit.lastCompletedDate === taskDateStr
            );
            const remainingDates = (linkedHabit.completedDates || []).filter((d) => d !== taskDateStr).sort();
            const newLastCompletedDate = remainingDates.length > 0 ? remainingDates[remainingDates.length - 1] : null;
            const nextCompletions = Math.max(0, (linkedHabit.totalCompletions || 0) - (wasAlreadyCompleted ? 1 : 0));
            const baseStreak = Math.max(0, (linkedHabit.streakDays || 0) - (wasAlreadyCompleted ? 1 : 0));

            const evalResult = evaluateHabitStreakAndWarnings(
              {
                ...linkedHabit.toObject(),
                lastCompletedDate: newLastCompletedDate,
                streakDays: baseStreak,
                completedDates: remainingDates,
                totalCompletions: nextCompletions,
              },
              taskDateStr
            );

            const nextConsistency = calculateHabitConsistency(
              {
                ...linkedHabit.toObject(),
                totalCompletions: nextCompletions,
                lastCompletedDate: newLastCompletedDate,
                completedDates: remainingDates,
              },
              taskDateStr
            );

            await Habit.updateOne(
              { _id: task.habitId, userId: req.user!.id },
              {
                $set: {
                  totalCompletions: nextCompletions,
                  streakDays: evalResult.streakDays,
                  warnings: evalResult.warnings,
                  consistencyRate: nextConsistency,
                  lastCompletedDate: newLastCompletedDate,
                  isArchived: false,
                },
                $pull: { completedDates: taskDateStr },
              }
            );
          }
        }
      }
      invalidateRankingsCache();
    }

    // When a task is checked off, check if all tasks for today are now 100% completed
    if (isCompleted === true) {
      try {
        const taskDateObj = task.date ? new Date(task.date) : new Date();
        const startOfDay = new Date(taskDateObj);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(taskDateObj);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const [pendingCount, totalCount] = await Promise.all([
          Task.countDocuments({
            userId: req.user!.id,
            deletedAt: null,
            date: { $gte: startOfDay, $lte: endOfDay },
            isCompleted: false,
          }),
          Task.countDocuments({
            userId: req.user!.id,
            deletedAt: null,
            date: { $gte: startOfDay, $lte: endOfDay },
          }),
        ]);

        if (totalCount > 0 && pendingCount === 0) {
          const dateTag = taskDateObj.toISOString().slice(0, 10);
          const subs = await PushSubscription.find({ userId: req.user!.id });
          for (const sub of subs) {
            if (sub.preferences?.completionChimes !== false) {
              await dispatchUnifiedNotification({
                sub,
                userId: req.user!.id,
                title: 'Checklist Cleared! 🏆',
                body: 'Incredible work! You completed 100% of your checklist items for today!',
                type: 'achievement',
                tag: `all-completed-${dateTag}`,
                url: '/',
              });
            }
          }
        }
      } catch (checkErr) {
        console.warn('[Tasks] Failed to evaluate completion notification:', checkErr);
      }
    }

    return sendSuccess(res, task, 'Task updated successfully');
  } catch (error) {
    return sendError(res, 'Failed to update task', 500, error);
  }
});

router.get('/trash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const trashedTasks = await Task.find({
      userId: req.user!.id,
      deletedAt: { $ne: null },
      isHabitInstance: { $ne: true },
      habitId: null,
    })
      .sort({ deletedAt: -1 })
      .limit(100)
      .populate('habitId', 'title category');

    return sendSuccess(res, trashedTasks, 'Trashed tasks fetched successfully');
  } catch (error) {
    return sendError(res, 'Failed to fetch trashed tasks', 500, error);
  }
});

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
