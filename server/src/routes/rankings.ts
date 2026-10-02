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

let cachedGlobalRankings: CachedRankings | null = null;
const RANKINGS_CACHE_TTL_MS = 60 * 1000; // 60-second TTL cache for global

export function invalidateRankingsCache(): void {
  cachedGlobalRankings = null;
}

function buildRankItem(
  u: Record<string, unknown> | null,
  userId: string,
  stats: { streakCount: number; consistencyRate: number; totalCompletions: number },
  rank: number,
  isCurrentUser: boolean,
  fallbackName: string = 'User'
): UserRankItem {
  const name = (u?.name as string) || (u?.username as string) || fallbackName;
  const rawHandle = (u?.username as string) || name.toLowerCase().replace(/\s+/g, '');
  const handle = `@${rawHandle.replace(/^@/, '')}`;
  const avatar = (u?.avatarUrl as string) || (u?.image as string) || '';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  return {
    userId,
    rank,
    userName: name,
    handle,
    userAvatar: avatar,
    initials,
    streakCount: Math.max(0, stats.streakCount || 0),
    consistencyRate: Math.max(0, Math.min(100, Math.round(stats.consistencyRate || 100))),
    totalCompletions: Math.max(0, stats.totalCompletions || 0),
    isOnline: true,
    isCurrentUser,
  };
}

router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = (req.query.type as string) || 'friends';
    const currentUserId = req.user?.id ? String(req.user.id) : '';

    // Prevent shared CDN / edge proxy caching of personalized rankings
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Vary', 'Cookie');

    // -------------------------------------------------------------
    // Branch A: Friends League (Scoped Strictly to Connected Users)
    // -------------------------------------------------------------
    if (type === 'friends') {
      if (!currentUserId) {
        return sendSuccess(res, {
          type: 'friends',
          currentUser: null,
          leaderboard: [],
        });
      }

      const currentAltId = req.user && (req.user as unknown as { _id?: string })._id
        ? String((req.user as unknown as { _id?: string })._id)
        : currentUserId;
      const currentUsername = (req.user as unknown as { username?: string })?.username || '';
      const currentName = req.user?.name || '';
      const currentEmail = req.user?.email || '';

      const currentAliases = Array.from(
        new Set([
          currentUserId,
          currentAltId,
          currentUsername,
          currentName,
          currentEmail,
          currentUsername.toLowerCase(),
          currentName.toLowerCase(),
          `@${currentUsername.toLowerCase().replace(/^@/, '')}`,
        ])
      ).filter(Boolean);

      // Find accepted friendships
      const friendships = await Friendship.find({
        status: 'ACCEPTED',
        $or: [
          { requesterId: { $in: currentAliases } },
          { recipientId: { $in: currentAliases } },
        ],
      }).lean();

      const rawPartnerIds = new Set<string>();
      for (const f of friendships) {
        const isCurrentRequester = currentAliases.includes(String(f.requesterId));
        const partnerId = isCurrentRequester ? String(f.recipientId) : String(f.requesterId);
        if (partnerId) rawPartnerIds.add(partnerId);
      }

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

      // Collect all valid user IDs for habits query (friends + current user)
      const targetUserIds = new Set<string>([currentUserId, currentAltId]);
      for (const u of friendUsers) {
        if (u.id) targetUserIds.add(String(u.id));
        if (u._id) targetUserIds.add(u._id.toString());
      }
      for (const pId of partnerIdsArray) {
        targetUserIds.add(pId);
      }

      const targetUserIdsList = Array.from(targetUserIds).filter(Boolean);

      // Aggregation pipeline scoped ONLY to target users
      const habitStats = await Habit.aggregate([
        {
          $match: {
            isArchived: { $ne: true },
            deletedAt: null,
            userId: { $in: targetUserIdsList },
          },
        },
        {
          $group: {
            _id: '$userId',
            streakCount: { $max: { $ifNull: ['$streakDays', 0] } },
            avgConsistency: { $avg: { $ifNull: ['$consistencyRate', 100] } },
            totalCompletions: { $sum: { $ifNull: ['$totalCompletions', 0] } },
          },
        },
      ]);

      const statsByUserId = new Map<string, { streakCount: number; consistencyRate: number; totalCompletions: number }>();
      for (const stat of habitStats) {
        statsByUserId.set(String(stat._id), {
          streakCount: stat.streakCount || 0,
          consistencyRate: Math.round(stat.avgConsistency || 100),
          totalCompletions: stat.totalCompletions || 0,
        });
      }

      // Build user documents map
      const usersMap = new Map<string, Record<string, unknown>>();
      for (const u of friendUsers) {
        if (u.id) usersMap.set(String(u.id), u);
        if (u._id) usersMap.set(u._id.toString(), u);
      }

      // Construct friend rank items
      const candidateList: UserRankItem[] = [];
      const seenIds = new Set<string>();

      // Add current user
      const currentUserStats = statsByUserId.get(currentUserId) || statsByUserId.get(currentAltId) || {
        streakCount: 0,
        consistencyRate: 100,
        totalCompletions: 0,
      };
      const currentUserDoc = req.user ? (req.user as unknown as Record<string, unknown>) : null;
      const currentRankItem = buildRankItem(
        currentUserDoc,
        currentUserId,
        currentUserStats,
        0,
        true,
        req.user?.name || req.user?.username || 'You'
      );
      candidateList.push(currentRankItem);
      seenIds.add(currentUserId);
      seenIds.add(currentAltId);

      // Add friends
      for (const u of friendUsers) {
        const uId = String(u.id || u._id?.toString() || '');
        if (!uId || seenIds.has(uId)) continue;
        seenIds.add(uId);

        const stats = statsByUserId.get(uId) || {
          streakCount: 0,
          consistencyRate: 100,
          totalCompletions: 0,
        };
        candidateList.push(buildRankItem(u, uId, stats, 0, false));
      }

      // Sort candidate list
      candidateList.sort((a, b) => {
        if (b.streakCount !== a.streakCount) return b.streakCount - a.streakCount;
        if (b.consistencyRate !== a.consistencyRate) return b.consistencyRate - a.consistencyRate;
        return b.totalCompletions - a.totalCompletions;
      });

      // Assign ranks
      candidateList.forEach((item, idx) => {
        item.rank = idx + 1;
      });

      const activeCurrentUser = candidateList.find((i) => i.isCurrentUser) || currentRankItem;

      return sendSuccess(res, {
        type: 'friends',
        currentUser: activeCurrentUser,
        leaderboard: candidateList,
      });
    }

    // -------------------------------------------------------------
    // Branch B: Global League (Optimized Database Aggregation)
    // -------------------------------------------------------------
    const isCacheExpired =
      !cachedGlobalRankings || Date.now() - cachedGlobalRankings.timestamp > RANKINGS_CACHE_TTL_MS;

    if (isCacheExpired) {
      // High-performance MongoDB aggregation for top 100 global ranks
      const topHabitStats = await Habit.aggregate([
        {
          $match: {
            isArchived: { $ne: true },
            deletedAt: null,
            userId: { $type: 'string', $ne: '' },
          },
        },
        {
          $group: {
            _id: '$userId',
            streakCount: { $max: { $ifNull: ['$streakDays', 0] } },
            avgConsistency: { $avg: { $ifNull: ['$consistencyRate', 100] } },
            totalCompletions: { $sum: { $ifNull: ['$totalCompletions', 0] } },
          },
        },
        {
          $sort: {
            streakCount: -1,
            avgConsistency: -1,
            totalCompletions: -1,
          },
        },
        { $limit: 100 },
      ]);

      const candidateUserIds = topHabitStats.map((s) => String(s._id));
      const objectIdQueries = candidateUserIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      const matchedUsers = candidateUserIds.length > 0
        ? await mongoDb
            .collection('user')
            .find({
              $or: [{ id: { $in: candidateUserIds } }, { _id: { $in: objectIdQueries } }],
            })
            .toArray()
        : [];

      const usersMap = new Map<string, Record<string, unknown>>();
      for (const u of matchedUsers) {
        if (u.id) usersMap.set(String(u.id), u);
        if (u._id) usersMap.set(u._id.toString(), u);
      }

      const rawRankItems: Omit<UserRankItem, 'isCurrentUser'>[] = [];
      topHabitStats.forEach((stat, index) => {
        const uId = String(stat._id);
        const userDoc = usersMap.get(uId) || null;
        const item = buildRankItem(
          userDoc,
          uId,
          {
            streakCount: stat.streakCount || 0,
            consistencyRate: stat.avgConsistency || 100,
            totalCompletions: stat.totalCompletions || 0,
          },
          index + 1,
          false
        );
        rawRankItems.push(item);
      });

      cachedGlobalRankings = {
        timestamp: Date.now(),
        items: rawRankItems,
      };
    }

    const cachedItems = cachedGlobalRankings?.items || [];
    let currentUserRankItem: UserRankItem | null = null;

    const globalLeaderboard: UserRankItem[] = cachedItems.map((item) => {
      const isMatch = Boolean(currentUserId && item.userId === currentUserId);
      const enrichedItem = { ...item, isCurrentUser: isMatch };
      if (isMatch) currentUserRankItem = enrichedItem;
      return enrichedItem;
    });

    // If current user is not in top 100, fetch their personal stats on-demand
    if (currentUserId && !currentUserRankItem) {
      const personalStats = await Habit.aggregate([
        {
          $match: {
            userId: currentUserId,
            isArchived: { $ne: true },
            deletedAt: null,
          },
        },
        {
          $group: {
            _id: '$userId',
            streakCount: { $max: { $ifNull: ['$streakDays', 0] } },
            avgConsistency: { $avg: { $ifNull: ['$consistencyRate', 100] } },
            totalCompletions: { $sum: { $ifNull: ['$totalCompletions', 0] } },
          },
        },
      ]);

      const stats = personalStats[0] || {
        streakCount: 0,
        avgConsistency: 100,
        totalCompletions: 0,
      };

      const userDoc = req.user ? (req.user as unknown as Record<string, unknown>) : null;
      currentUserRankItem = buildRankItem(
        userDoc,
        currentUserId,
        {
          streakCount: stats.streakCount || 0,
          consistencyRate: stats.avgConsistency || 100,
          totalCompletions: stats.totalCompletions || 0,
        },
        globalLeaderboard.length + 1,
        true,
        req.user?.name || req.user?.username || 'You'
      );
    }

    return sendSuccess(res, {
      type: 'global',
      currentUser: currentUserRankItem,
      leaderboard: globalLeaderboard,
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch rankings', 500, error);
  }
});

export default router;
