import { Router, Response } from 'express';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { mongoDb } from '../db/connection.js';
import { Habit } from '../models/Habit.js';
import { Friendship } from '../models/Friendship.js';

const router = Router();

export interface UserRankItem {
  userId: string;
  rank: number;
  userName: string;
  handle: string;
  userAvatar?: string;
  initials?: string;
  streakCount: number;
  consistencyRate: number;
  totalCompletions: number;
  isOnline: boolean;
  isCurrentUser?: boolean;
}

/**
 * GET /api/rankings
 * Query param: type = 'global' | 'friends'
 * Returns continuous leaderboard ranked strictly by active habit streak count (no weekly reset)
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = (req.query.type as string) || 'friends';
    const currentUserId = req.user?.id;

    // 1. Fetch real registered users from MongoDB user collection
    const users = await mongoDb.collection('user').find({}).toArray();

    // 2. Fetch all active habits (not archived, not deleted)
    const habits = await Habit.find({
      isArchived: { $ne: true },
      deletedAt: null,
    }).lean();

    // Group habits by userId
    const habitsByUser = new Map<string, typeof habits>();
    for (const habit of habits) {
      if (!habit.userId) continue;
      const list = habitsByUser.get(habit.userId) || [];
      list.push(habit);
      habitsByUser.set(habit.userId, list);
    }

    // 3. Build ranking items for each user
    const allRankItems: UserRankItem[] = users.map((u) => {
      const uId = (u.id as string) || u._id?.toString() || '';
      const userHabits =
        habitsByUser.get(uId) || habitsByUser.get(u._id?.toString() || '') || [];

      // Streak rank factor: maximum active streak across user's active habits
      const streakCount =
        userHabits.length > 0
          ? Math.max(...userHabits.map((h) => Number(h.streakDays) || 0))
          : 0;

      // Consistency: average consistencyRate across habits (default 100%)
      const consistencyRate =
        userHabits.length > 0
          ? Math.round(
              userHabits.reduce(
                (acc, h) =>
                  acc + (typeof h.consistencyRate === 'number' ? h.consistencyRate : 100),
                0
              ) / userHabits.length
            )
          : 100;

      const totalCompletions = userHabits.reduce(
        (acc, h) => acc + (Number(h.totalCompletions) || 0),
        0
      );

      const name = (u.name as string) || (u.username as string) || 'User';
      const rawHandle =
        (u.username as string) || name.toLowerCase().replace(/\s+/g, '');
      const handle = `@${rawHandle.replace(/^@/, '')}`;
      const avatar = (u.avatarUrl as string) || (u.image as string) || '';
      const initials =
        name
          .split(' ')
          .filter(Boolean)
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'U';

      const isCurrentUser = Boolean(
        currentUserId &&
          (uId === currentUserId || u._id?.toString() === currentUserId)
      );

      return {
        userId: uId,
        rank: 0,
        userName: name,
        handle,
        userAvatar: avatar,
        initials,
        streakCount,
        consistencyRate,
        totalCompletions,
        isOnline: true,
        isCurrentUser,
      };
    });

    // If current logged-in user isn't in users list yet (e.g. freshly created session), include them
    if (currentUserId && !allRankItems.some((item) => item.isCurrentUser)) {
      const currentUserName = req.user?.name || 'You';
      const currentUserAvatar =
        (req.user as unknown as { image?: string })?.image || '';
      allRankItems.push({
        userId: currentUserId,
        rank: 0,
        userName: currentUserName,
        handle: `@${currentUserName.toLowerCase().replace(/\s+/g, '')}`,
        userAvatar: currentUserAvatar,
        initials: currentUserName.slice(0, 2).toUpperCase(),
        streakCount: 0,
        consistencyRate: 100,
        totalCompletions: 0,
        isOnline: true,
        isCurrentUser: true,
      });
    }

    // 4. Sort strictly by streakCount descending, then consistencyRate descending
    allRankItems.sort((a, b) => {
      if (b.streakCount !== a.streakCount) return b.streakCount - a.streakCount;
      if (b.consistencyRate !== a.consistencyRate) return b.consistencyRate - a.consistencyRate;
      return b.totalCompletions - a.totalCompletions;
    });

    // Assign continuous all-time ranks (1, 2, 3...)
    allRankItems.forEach((item, index) => {
      item.rank = index + 1;
    });

    // Identify current user item
    let currentUserItem = allRankItems.find((item) => item.isCurrentUser);
    if (!currentUserItem && allRankItems.length > 0) {
      currentUserItem = allRankItems[0];
    } else if (!currentUserItem) {
      currentUserItem = {
        userId: currentUserId || 'guest',
        rank: 1,
        userName: req.user?.name || 'You',
        handle: '@you',
        streakCount: 0,
        consistencyRate: 100,
        totalCompletions: 0,
        isOnline: true,
        isCurrentUser: true,
      };
    }

    // 5. Handle Friends League vs Global League
    if (type === 'friends' && currentUserId) {
      // Find accepted friendships for current user
      const friendships = await Friendship.find({
        status: 'ACCEPTED',
        $or: [{ requesterId: currentUserId }, { recipientId: currentUserId }],
      }).lean();

      const friendUserIds = new Set<string>();
      friendUserIds.add(currentUserId);
      for (const f of friendships) {
        if (f.requesterId === currentUserId) friendUserIds.add(f.recipientId);
        else friendUserIds.add(f.requesterId);
      }

      // Filter leaderboard to only friends + current user
      const friendsLeaderboard = allRankItems
        .filter((item) => friendUserIds.has(item.userId))
        .map((item, idx) => ({
          ...item,
          rank: idx + 1,
        }));

      return sendSuccess(res, {
        type: 'friends',
        currentUser:
          friendsLeaderboard.find((i) => i.isCurrentUser) || currentUserItem,
        leaderboard: friendsLeaderboard,
      });
    }

    // Default: Global League
    return sendSuccess(res, {
      type: 'global',
      currentUser: currentUserItem,
      leaderboard: allRankItems,
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch rankings', 500, error);
  }
});

export default router;

