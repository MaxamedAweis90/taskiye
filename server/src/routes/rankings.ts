import { Router, Response } from 'express';
import { ObjectId } from 'mongodb';
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

interface CachedRankings {
  timestamp: number;
  items: Omit<UserRankItem, 'isCurrentUser'>[];
}

let cachedRankings: CachedRankings | null = null;
const RANKINGS_CACHE_TTL_MS = 60 * 1000; // 60-second TTL cache

export function invalidateRankingsCache(): void {
  cachedRankings = null;
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

    // Prevent shared CDN / edge proxy caching of personalized rankings
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Vary', 'Cookie');

    // 1. Check if we have fresh in-memory cached global rankings
    const isCacheExpired = !cachedRankings || (Date.now() - cachedRankings.timestamp > RANKINGS_CACHE_TTL_MS);

    if (isCacheExpired) {
      // Fetch real registered users from MongoDB user collection
      const users = await mongoDb.collection('user').find({}).toArray();

      // Fetch all active habits (not archived, not deleted)
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

      // Build ranking items for each user
      const rawRankItems: Omit<UserRankItem, 'isCurrentUser'>[] = users.map((u) => {
        const uId = String((u.id as string) || u._id?.toString() || '');
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
        };
      });

      // Sort strictly by streakCount descending, then consistencyRate descending
      rawRankItems.sort((a, b) => {
        if (b.streakCount !== a.streakCount) return b.streakCount - a.streakCount;
        if (b.consistencyRate !== a.consistencyRate) return b.consistencyRate - a.consistencyRate;
        return b.totalCompletions - a.totalCompletions;
      });

      // Assign continuous all-time ranks (1, 2, 3...)
      rawRankItems.forEach((item, index) => {
        item.rank = index + 1;
      });

      cachedRankings = {
        timestamp: Date.now(),
        items: rawRankItems,
      };
    }

    const currentUserIdStr = currentUserId ? String(currentUserId) : '';

    // 2. Clone cached global list and map isCurrentUser defensively for requester
    const cachedItems = cachedRankings?.items || [];
    const allRankItems: UserRankItem[] = cachedItems.map((item) => ({
      ...item,
      isCurrentUser: Boolean(
        currentUserIdStr &&
          (item.userId === currentUserIdStr || String(item.userId) === currentUserIdStr)
      ),
    }));

    // If current logged-in user isn't in users list yet, add them so they are represented
    if (currentUserIdStr && !allRankItems.some((item) => item.isCurrentUser)) {
      const currentUserName = req.user?.name || req.user?.username || 'You';
      const currentUserAvatar =
        (req.user as unknown as { avatarUrl?: string; image?: string })?.avatarUrl ||
        (req.user as unknown as { image?: string })?.image ||
        '';
      allRankItems.push({
        userId: currentUserIdStr,
        rank: allRankItems.length + 1,
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

    // Identify current user item: strictly matching authenticated session
    let currentUserItem: UserRankItem | null =
      allRankItems.find((item) => item.isCurrentUser) || null;

    // NEVER fall back to allRankItems[0] for guests or unmatched sessions
    if (!currentUserItem && currentUserIdStr) {
      const fallbackName = req.user?.name || req.user?.username || 'You';
      currentUserItem = {
        userId: currentUserIdStr,
        rank: allRankItems.length + 1,
        userName: fallbackName,
        handle: `@${fallbackName.toLowerCase().replace(/\s+/g, '')}`,
        userAvatar: (req.user as unknown as { image?: string })?.image || '',
        initials: fallbackName.slice(0, 2).toUpperCase(),
        streakCount: 0,
        consistencyRate: 100,
        totalCompletions: 0,
        isOnline: true,
        isCurrentUser: true,
      };
    }

    // 5. Handle Friends League vs Global League
    if (type === 'friends') {
      if (!currentUserIdStr) {
        return sendSuccess(res, {
          type: 'friends',
          currentUser: null,
          leaderboard: [],
        });
      }

      // Collect all aliases for the current authenticated user
      const currentAltId = req.user && (req.user as unknown as { _id?: string })._id
        ? String((req.user as unknown as { _id?: string })._id)
        : currentUserIdStr;
      const currentUsername = (req.user as unknown as { username?: string })?.username || '';
      const currentName = req.user?.name || '';
      const currentEmail = req.user?.email || '';

      const currentAliases = Array.from(
        new Set([
          currentUserIdStr,
          currentAltId,
          currentUsername,
          currentName,
          currentEmail,
          currentUsername.toLowerCase(),
          currentName.toLowerCase(),
          `@${currentUsername.toLowerCase().replace(/^@/, '')}`,
        ])
      ).filter(Boolean);

      // Find accepted friendships for current user matching any alias
      const friendships = await Friendship.find({
        status: 'ACCEPTED',
        $or: [
          { requesterId: { $in: currentAliases } },
          { recipientId: { $in: currentAliases } },
        ],
      }).lean();

      // Collect raw partner IDs/aliases from friendships
      const rawPartnerIds = new Set<string>();
      for (const f of friendships) {
        const isCurrentRequester = currentAliases.includes(String(f.requesterId));
        const partnerId = isCurrentRequester ? String(f.recipientId) : String(f.requesterId);
        if (partnerId) rawPartnerIds.add(partnerId);
      }

      // Look up partner user records in MongoDB to resolve their full alias set
      const partnerIdsArray = Array.from(rawPartnerIds);
      const queryOr: Record<string, unknown>[] = [
        { id: { $in: partnerIdsArray } },
        { username: { $in: partnerIdsArray } },
        { name: { $in: partnerIdsArray } },
        { email: { $in: partnerIdsArray } },
      ];
      for (const pId of partnerIdsArray) {
        if (ObjectId.isValid(pId)) {
          queryOr.push({ _id: new ObjectId(pId) });
        }
      }

      const friendUsers = partnerIdsArray.length > 0
        ? await mongoDb.collection('user').find({ $or: queryOr }).toArray()
        : [];

      // Build a fast lookup set containing all aliases for accepted friends
      const friendMatchSet = new Set<string>();
      for (const pId of partnerIdsArray) {
        friendMatchSet.add(pId.toLowerCase());
      }
      for (const u of friendUsers) {
        if (u._id) friendMatchSet.add(u._id.toString().toLowerCase());
        if (u.id) friendMatchSet.add(String(u.id).toLowerCase());
        if (u.username) {
          const uLower = String(u.username).toLowerCase();
          friendMatchSet.add(uLower);
          friendMatchSet.add(uLower.replace(/^@/, ''));
        }
        if (u.name) friendMatchSet.add(String(u.name).toLowerCase());
        if (u.email) friendMatchSet.add(String(u.email).toLowerCase());
      }

      // Filter leaderboard to friends + current user
      let friendsLeaderboard = allRankItems
        .filter((item) => {
          if (item.isCurrentUser) return true;
          const uId = String(item.userId).toLowerCase();
          const uHandle = item.handle.toLowerCase().replace(/^@/, '');
          const uName = item.userName.toLowerCase();
          return (
            friendMatchSet.has(uId) ||
            friendMatchSet.has(uHandle) ||
            friendMatchSet.has(uName)
          );
        })
        .map((item, idx) => ({
          ...item,
          rank: idx + 1,
        }));

      // Ensure current user appears in friendsLeaderboard
      if (currentUserItem && !friendsLeaderboard.some((i) => i.isCurrentUser)) {
        friendsLeaderboard = [
          { ...currentUserItem, rank: 1 },
          ...friendsLeaderboard.map((i, idx) => ({ ...i, rank: idx + 2 })),
        ];
      }

      const activeCurrentUser =
        friendsLeaderboard.find((i) => i.isCurrentUser) || currentUserItem;

      return sendSuccess(res, {
        type: 'friends',
        currentUser: activeCurrentUser,
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

