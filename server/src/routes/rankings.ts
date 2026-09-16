import { Router, Response } from 'express';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

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

// Global leaderboard ranked purely by streak days
const MOCK_GLOBAL_LEADERBOARD: UserRankItem[] = [
  {
    userId: 'user_1',
    rank: 1,
    userName: 'Elena Rostova',
    handle: '@elena_flow',
    initials: 'ER',
    streakCount: 48,
    consistencyRate: 99.4,
    totalCompletions: 78,
    isOnline: true,
  },
  {
    userId: 'user_2',
    rank: 2,
    userName: 'Marcus Chen',
    handle: '@mchen_code',
    initials: 'MC',
    streakCount: 34,
    consistencyRate: 97.8,
    totalCompletions: 62,
    isOnline: true,
  },
  {
    userId: 'user_3',
    rank: 3,
    userName: 'Sarah Jenkins',
    handle: '@sjenkins',
    initials: 'SJ',
    streakCount: 29,
    consistencyRate: 96.5,
    totalCompletions: 51,
    isOnline: true,
  },
  {
    userId: 'user_4',
    rank: 4,
    userName: 'David Kim',
    handle: '@davidk',
    initials: 'DK',
    streakCount: 26,
    consistencyRate: 95.0,
    totalCompletions: 44,
    isOnline: true,
  },
  {
    userId: 'user_5',
    rank: 5,
    userName: 'Maya Lin',
    handle: '@mayalin',
    initials: 'ML',
    streakCount: 22,
    consistencyRate: 93.8,
    totalCompletions: 38,
    isOnline: true,
  },
  {
    userId: 'user_6',
    rank: 6,
    userName: 'Jonas Berg',
    handle: '@jberg',
    initials: 'JB',
    streakCount: 19,
    consistencyRate: 91.4,
    totalCompletions: 32,
    isOnline: true,
  },
  {
    userId: 'user_7',
    rank: 7,
    userName: 'Sora Nakamura',
    handle: '@nakasora',
    initials: 'SN',
    streakCount: 18,
    consistencyRate: 89.6,
    totalCompletions: 28,
    isOnline: false,
  },
];

/**
 * GET /api/rankings
 * Query param: type = 'global' | 'friends'
 * Returns leaderboard ranked strictly by streakCount
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = (req.query.type as string) || 'global';
    const currentUserId = req.user?.id || 'user_current';
    const currentUserName = req.user?.name || 'Alex Morgan';
    const currentUserAvatar = (req.user as unknown as { image?: string })?.image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

    const currentUserItem: UserRankItem = {
      userId: currentUserId,
      rank: 14,
      userName: currentUserName,
      handle: '@alexmorgan',
      userAvatar: currentUserAvatar,
      streakCount: 12,
      consistencyRate: 94.2,
      totalCompletions: 24,
      isOnline: true,
      isCurrentUser: true,
    };

    if (type === 'friends') {
      const friendsLeaderboard = [
        MOCK_GLOBAL_LEADERBOARD[0],
        MOCK_GLOBAL_LEADERBOARD[1],
        MOCK_GLOBAL_LEADERBOARD[2],
        MOCK_GLOBAL_LEADERBOARD[3],
        currentUserItem,
      ]
        .filter((item): item is UserRankItem => Boolean(item))
        .sort((a, b) => b.streakCount - a.streakCount);

      return sendSuccess(res, {
        type: 'friends',
        currentUser: currentUserItem,
        leaderboard: friendsLeaderboard,
      });
    }

    // Default: Global Leaderboard
    const fullGlobalList: UserRankItem[] = [...MOCK_GLOBAL_LEADERBOARD, currentUserItem].sort(
      (a, b) => b.streakCount - a.streakCount
    );

    return sendSuccess(res, {
      type: 'global',
      currentUser: currentUserItem,
      leaderboard: fullGlobalList,
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch rankings', 500, error);
  }
});

export default router;
