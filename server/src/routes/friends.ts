import { Router, Response } from 'express';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { Friendship } from '../models/Friendship.js';

const router = Router();

/**
 * GET /api/friends
 * List friends and pending requests
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'guest_user';

    const friendships = await Friendship.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
    }).sort({ updatedAt: -1 });

    return sendSuccess(res, {
      userId,
      friends: friendships.filter((f) => f.status === 'ACCEPTED'),
      pendingIncoming: friendships.filter((f) => f.recipientId === userId && f.status === 'PENDING'),
      pendingOutgoing: friendships.filter((f) => f.requesterId === userId && f.status === 'PENDING'),
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch friends', 500, error);
  }
});

/**
 * GET /api/friends/search?q=...
 * Searches users starting with query prefix (e.g. @marcus or elena)
 */
router.get('/search', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawQuery = ((req.query.q as string) || '').trim().replace(/^@/, '').toLowerCase();
    
    // Directory of searchable community members
    const ALL_MEMBERS = [
      { id: 'user_1', name: 'Elena Rostova', handle: '@elena_flow', initials: 'ER', streakDays: 48, consistency: 99.4 },
      { id: 'user_2', name: 'Marcus Chen', handle: '@mchen_code', initials: 'MC', streakDays: 34, consistency: 97.8 },
      { id: 'user_3', name: 'Sarah Jenkins', handle: '@sjenkins', initials: 'SJ', streakDays: 29, consistency: 96.5 },
      { id: 'user_4', name: 'David Kim', handle: '@davidk', initials: 'DK', streakDays: 26, consistency: 95.0 },
      { id: 'user_5', name: 'Maya Lin', handle: '@mayalin', initials: 'ML', streakDays: 22, consistency: 93.8 },
      { id: 'user_6', name: 'Jonas Berg', handle: '@jberg', initials: 'JB', streakDays: 19, consistency: 91.4 },
      { id: 'user_7', name: 'Sora Nakamura', handle: '@nakasora', initials: 'SN', streakDays: 18, consistency: 89.6 },
      { id: 'user_8', name: 'Fatima Al-Mansoor', handle: '@fatima_m', initials: 'FA', streakDays: 16, consistency: 92.1 },
      { id: 'user_9', name: 'Liam O’Connor', handle: '@liam_oc', initials: 'LO', streakDays: 11, consistency: 88.4 },
      { id: 'user_10', name: 'Amara Okafor', handle: '@amara_o', initials: 'AO', streakDays: 9, consistency: 85.0 },
    ];

    if (!rawQuery) {
      return sendSuccess(res, ALL_MEMBERS.slice(0, 6));
    }

    const matches = ALL_MEMBERS.filter(
      (m) =>
        m.name.toLowerCase().startsWith(rawQuery) ||
        m.handle.toLowerCase().replace('@', '').startsWith(rawQuery)
    );

    return sendSuccess(res, matches);
  } catch (error) {
    return sendError(res, 'Failed to search users', 500, error);
  }
});

/**
 * POST /api/friends/request
 * Send a friend request via username search or QR code token
 */
router.post('/request', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'guest_user';
    const { targetUsername, qrToken } = req.body;

    if (!targetUsername && !qrToken) {
      return sendError(res, 'Either targetUsername or qrToken is required', 400);
    }

    // In a full implementation, resolve targetUsername or qrToken to targetUserId.
    // For stub/initialization, generate or mock target user identifier:
    const targetUserId = targetUsername
      ? `user_${encodeURIComponent(targetUsername.toLowerCase().trim())}`
      : `user_qr_${qrToken}`;

    if (targetUserId === userId) {
      return sendError(res, 'You cannot send a friend request to yourself', 400);
    }

    // Check if friendship or request already exists
    const existing = await Friendship.findOne({
      $or: [
        { requesterId: userId, recipientId: targetUserId },
        { requesterId: targetUserId, recipientId: userId },
      ],
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return sendError(res, 'You are already friends with this user', 400);
      }
      if (existing.status === 'PENDING') {
        return sendError(res, 'A friend request is already pending', 400);
      }
    }

    // Create new friend request
    const friendship = await Friendship.create({
      requesterId: userId,
      recipientId: targetUserId,
      status: 'PENDING',
    });

    return sendSuccess(
      res,
      friendship,
      `Friend request sent to ${targetUsername || 'user'} successfully`,
      201
    );
  } catch (error) {
    return sendError(res, 'Failed to send friend request', 500, error);
  }
});

/**
 * POST /api/friends/respond
 * Accept or reject a friend request
 */
router.post('/respond', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'guest_user';
    const { friendshipId, action } = req.body;

    if (!friendshipId) {
      return sendError(res, 'friendshipId is required', 400);
    }

    if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
      return sendError(res, "Action must be either 'ACCEPT' or 'REJECT'", 400);
    }

    const nextStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

    const friendship = await Friendship.findOneAndUpdate(
      {
        _id: friendshipId,
        recipientId: userId,
        status: 'PENDING',
      },
      { $set: { status: nextStatus } },
      { new: true }
    );

    if (!friendship) {
      return sendError(
        res,
        'Friend request not found or you are not authorized to respond',
        404
      );
    }

    return sendSuccess(
      res,
      friendship,
      `Friend request ${action === 'ACCEPT' ? 'accepted' : 'declined'} successfully`
    );
  } catch (error) {
    return sendError(res, 'Failed to respond to friend request', 500, error);
  }
});

export default router;
