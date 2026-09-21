import { Router, Response } from 'express';
import { ObjectId } from 'mongodb';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { Friendship } from '../models/Friendship.js';
import { Habit } from '../models/Habit.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { dispatchUnifiedNotification } from '../lib/push.js';
import { mongoDb } from '../db/connection.js';
import { searchLimiter, socialLimiter } from '../middleware/rateLimiter.js';
import { invalidateRankingsCache } from './rankings.js';

const router = Router();

/**
 * GET /api/friends
 * List friends and pending requests with populated user details
 */
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Vary', 'Cookie');
  try {
    const currentUserId = req.user?.id ? String(req.user.id) : '';
    if (!currentUserId) {
      return sendSuccess(res, {
        userId: 'guest_user',
        friends: [],
        pendingIncoming: [],
        pendingOutgoing: [],
      });
    }

    const currentAltId = req.user && (req.user as unknown as { _id?: string })._id
      ? String((req.user as unknown as { _id?: string })._id)
      : currentUserId;

    const userIds = Array.from(new Set([currentUserId, currentAltId]));

    const friendships = await Friendship.find({
      $or: [
        { requesterId: { $in: userIds } },
        { recipientId: { $in: userIds } },
      ],
    }).sort({ updatedAt: -1 }).lean();

    // Collect all other user IDs
    const otherUserIds = new Set<string>();
    for (const f of friendships) {
      const otherId = userIds.includes(String(f.requesterId))
        ? String(f.recipientId)
        : String(f.requesterId);
      if (otherId) otherUserIds.add(otherId);
    }

    const otherIdsArray = Array.from(otherUserIds);

    // Fetch user profiles for all related users
    const queryOr: Record<string, unknown>[] = [
      { id: { $in: otherIdsArray } },
    ];
    for (const idStr of otherIdsArray) {
      try {
        queryOr.push({ _id: new ObjectId(idStr) });
      } catch {
        // Not a valid ObjectId hex string
      }
    }

    const users = await mongoDb.collection('user').find({ $or: queryOr }).toArray();
    const userMap = new Map<string, { name: string; username: string; handle: string; avatarUrl: string }>();

    for (const u of users) {
      const uId = String((u.id as string) || u._id?.toString() || '');
      const rawName = (u.name as string) || (u.username as string) || 'User';
      const rawUsername = (u.username as string) || rawName.toLowerCase().replace(/\s+/g, '');
      const handle = `@${rawUsername.replace(/^@/, '')}`;
      const avatarUrl = (u.avatarUrl as string) || (u.image as string) || '';

      const obj = { name: rawName, username: rawUsername, handle, avatarUrl };
      userMap.set(uId, obj);
      if (u._id) userMap.set(u._id.toString(), obj);
    }

    // Fetch habits for streaks
    const habits = await Habit.find({
      userId: { $in: otherIdsArray },
      isArchived: { $ne: true },
      deletedAt: null,
    }).lean();

    const habitsByUser = new Map<string, typeof habits>();
    for (const h of habits) {
      if (!h.userId) continue;
      const list = habitsByUser.get(String(h.userId)) || [];
      list.push(h);
      habitsByUser.set(String(h.userId), list);
    }

    const formatFriendshipItem = (f: typeof friendships[0], isIncoming: boolean) => {
      const targetUserId = isIncoming ? String(f.requesterId) : String(f.recipientId);
      const profile = userMap.get(targetUserId) || {
        name: 'User',
        username: 'user',
        handle: '@user',
        avatarUrl: '',
      };
      const userHabits = habitsByUser.get(targetUserId) || [];
      const streakDays = userHabits.length > 0
        ? Math.max(...userHabits.map((h) => Number(h.streakDays) || 0))
        : 0;

      return {
        friendshipId: String(f._id),
        id: targetUserId,
        userId: targetUserId,
        name: profile.name,
        username: profile.username,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl,
        streakDays,
        status: f.status,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
    };

    const acceptedFriends = friendships
      .filter((f) => f.status === 'ACCEPTED')
      .map((f) => {
        const isIncoming = !userIds.includes(String(f.requesterId));
        return formatFriendshipItem(f, isIncoming);
      });

    const pendingIncoming = friendships
      .filter((f) => userIds.includes(String(f.recipientId)) && f.status === 'PENDING')
      .map((f) => formatFriendshipItem(f, true));

    const pendingOutgoing = friendships
      .filter((f) => userIds.includes(String(f.requesterId)) && f.status === 'PENDING')
      .map((f) => formatFriendshipItem(f, false));

    return sendSuccess(res, {
      userId: currentUserId,
      friends: acceptedFriends,
      pendingIncoming,
      pendingOutgoing,
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch friends', 500, error);
  }
});

/**
 * GET /api/friends/search?q=...
 * Searches real registered users, strictly excluding the authenticated user
 */
router.get('/search', searchLimiter, optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawQuery = ((req.query.q as string) || '').trim().replace(/^@/, '').toLowerCase();
    if (rawQuery.length > 50) {
      return sendError(res, 'Search query too long', 400);
    }
    const escapedQuery = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const currentUserId = req.user?.id;
    const currentUserEmail = req.user?.email;
    const currentUsername = (req.user as unknown as { username?: string })?.username;

    // Multi-criteria exclusion for authenticated user
    const exclusions: Record<string, unknown>[] = [];
    if (currentUserId) {
      exclusions.push({ id: currentUserId });
      exclusions.push({ _id: currentUserId });
      try {
        exclusions.push({ _id: new ObjectId(currentUserId) });
      } catch {
        // Not a valid ObjectId hex string, ignore
      }
    }
    if (currentUserEmail) {
      exclusions.push({ email: currentUserEmail.toLowerCase() });
    }
    if (currentUsername) {
      exclusions.push({ username: currentUsername });
    }

    const filter: Record<string, unknown> = {};
    if (exclusions.length > 0) {
      filter.$nor = exclusions;
    }

    if (escapedQuery) {
      const regex = { $regex: escapedQuery, $options: 'i' };
      filter.$or = [{ name: regex }, { username: regex }, { email: regex }];
    }

    // Query real users from database
    const rawUsers = await mongoDb.collection('user').find(filter).limit(20).toArray();

    // Additional defensive in-memory filter
    const users = rawUsers.filter((u) => {
      const uId = (u.id as string) || u._id?.toString();
      if (currentUserId && (uId === currentUserId || u._id?.toString() === currentUserId)) return false;
      if (currentUserEmail && u.email && String(u.email).toLowerCase() === currentUserEmail.toLowerCase()) return false;
      if (currentUsername && u.username && String(u.username).toLowerCase() === currentUsername.toLowerCase()) return false;
      return true;
    });

    // Query active habits for these users to calculate real streak count
    const userIds = users.map((u) => (u.id as string) || u._id?.toString()).filter(Boolean);
    const habits = await Habit.find({
      userId: { $in: userIds },
      isArchived: { $ne: true },
      deletedAt: null,
    }).lean();

    const habitsByUser = new Map<string, typeof habits>();
    for (const h of habits) {
      if (!h.userId) continue;
      const list = habitsByUser.get(h.userId) || [];
      list.push(h);
      habitsByUser.set(h.userId, list);
    }

    const matches = users.map((u) => {
      const uId = (u.id as string) || u._id?.toString() || '';
      const userHabits = habitsByUser.get(uId) || [];
      const streakDays =
        userHabits.length > 0
          ? Math.max(...userHabits.map((h) => Number(h.streakDays) || 0))
          : 0;
      const consistency =
        userHabits.length > 0
          ? Math.round(
              userHabits.reduce(
                (acc, h) =>
                  acc + (typeof h.consistencyRate === 'number' ? h.consistencyRate : 100),
                0
              ) / userHabits.length
            )
          : 100;

      const name = (u.name as string) || (u.username as string) || 'User';
      const handle = `@${((u.username as string) || name.toLowerCase().replace(/\s+/g, '')).replace(/^@/, '')}`;
      const avatarUrl = (u.avatarUrl as string) || (u.image as string) || '';
      const initials =
        name
          .split(' ')
          .filter(Boolean)
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'U';

      return {
        id: uId,
        name,
        handle,
        avatarUrl,
        initials,
        streakDays,
        consistency,
      };
    });

    return sendSuccess(res, matches);
  } catch (error) {
    return sendError(res, 'Failed to search users', 500, error);
  }
});

/**
 * POST /api/friends/request
 * Send a friend request to a real user via targetUserId, targetUsername search, or QR code token
 */
router.post('/request', socialLimiter, optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
      ? String(req.user.id)
      : req.user && (req.user as unknown as { _id?: string })._id
        ? String((req.user as unknown as { _id?: string })._id)
        : '';

    if (!userId) {
      return sendError(res, 'Please sign in or create an account to send friend requests', 401);
    }

    const senderName = req.user?.name || req.user?.username || 'A rival';
    const { targetUserId: directTargetUserId, targetUsername, qrToken } = req.body;

    if (!directTargetUserId && !targetUsername && !qrToken) {
      return sendError(res, 'Target user identifier is required', 400);
    }

    let targetUserDoc: Record<string, unknown> | null = null;

    if (directTargetUserId) {
      const cleanId = String(directTargetUserId).trim();
      if (ObjectId.isValid(cleanId)) {
        targetUserDoc = await mongoDb.collection('user').findOne({
          $or: [{ _id: new ObjectId(cleanId) }, { id: cleanId }],
        });
      } else {
        targetUserDoc = await mongoDb.collection('user').findOne({ id: cleanId });
      }
    }

    if (!targetUserDoc && targetUsername) {
      const cleanTarget = String(targetUsername).trim().replace(/^@/, '');
      if (cleanTarget.length <= 50) {
        const escapedTarget = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryList: Record<string, unknown>[] = [
          { username: { $regex: `^${escapedTarget}$`, $options: 'i' } },
          { name: { $regex: `^${escapedTarget}$`, $options: 'i' } },
          { email: cleanTarget.toLowerCase() },
        ];
        if (ObjectId.isValid(cleanTarget)) {
          queryList.push({ _id: new ObjectId(cleanTarget) });
        }
        targetUserDoc = await mongoDb.collection('user').findOne({ $or: queryList });
      }
    }

    if (!targetUserDoc && qrToken) {
      const cleanToken = String(qrToken).replace('taskiye:user:', '').trim();
      if (ObjectId.isValid(cleanToken)) {
        targetUserDoc = await mongoDb.collection('user').findOne({
          $or: [{ _id: new ObjectId(cleanToken) }, { id: cleanToken }],
        });
      } else {
        targetUserDoc = await mongoDb.collection('user').findOne({ id: cleanToken });
      }
    }

    if (!targetUserDoc) {
      return sendError(res, 'User not found. Check username, handle, or QR code.', 404);
    }

    const targetUserId = targetUserDoc._id
      ? targetUserDoc._id.toString()
      : String(targetUserDoc.id || '');
    const targetName =
      (targetUserDoc.name as string) || (targetUserDoc.username as string) || 'User';

    if (!targetUserId || targetUserId === userId) {
      return sendError(
        res,
        "That's your own profile! Share your QR code or handle with a friend to connect.",
        400
      );
    }

    // Check if a friendship relationship already exists in either direction
    const existing = await Friendship.findOne({
      $or: [
        { requesterId: userId, recipientId: targetUserId },
        { requesterId: targetUserId, recipientId: userId },
      ],
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return sendSuccess(res, existing, `You are already friends with ${targetName}!`, 200);
      }

      if (existing.status === 'PENDING') {
        // If the other user already invited the requester, auto-accept immediately!
        if (String(existing.recipientId) === String(userId)) {
          existing.status = 'ACCEPTED';
          await existing.save();
          invalidateRankingsCache();

          try {
            await dispatchUnifiedNotification({
              userId: targetUserId,
              title: 'Friend Request Accepted! ⚡',
              body: `${senderName} connected with you! View your rank in Friends League.`,
              type: 'system',
              tag: `friend-accepted-${existing._id}`,
              url: '/rank',
            });
          } catch (notifErr) {
            console.warn('[Friends] Failed to deliver notification:', notifErr);
          }

          return sendSuccess(
            res,
            existing,
            `Connected! You and ${targetName} are now rivals in Friends League.`,
            200
          );
        }

        return sendSuccess(
          res,
          existing,
          `Friend request to ${targetName} is already pending.`,
          200
        );
      }

      // If existing status was REJECTED, reactivate the friendship request as PENDING
      if (existing.status === 'REJECTED') {
        existing.requesterId = userId;
        existing.recipientId = targetUserId;
        existing.status = 'PENDING';
        await existing.save();

        try {
          const recipientSubs = await PushSubscription.find({ userId: targetUserId });
          if (recipientSubs.length > 0) {
            for (const sub of recipientSubs) {
              await dispatchUnifiedNotification({
                sub,
                userId: targetUserId,
                title: 'New Friend Request! 🏆',
                body: `${senderName} challenged you to a streak rivalry on Taskiye!`,
                type: 'system',
                tag: `friend-request-${existing._id}`,
                url: '/rank',
                data: { friendshipId: String(existing._id) },
              });
            }
          } else {
            await dispatchUnifiedNotification({
              userId: targetUserId,
              title: 'New Friend Request! 🏆',
              body: `${senderName} challenged you to a streak rivalry on Taskiye!`,
              type: 'system',
              tag: `friend-request-${existing._id}`,
              url: '/rank',
              data: { friendshipId: String(existing._id) },
            });
          }
        } catch (notifErr) {
          console.warn('[Friends] Failed to deliver notification:', notifErr);
        }

        return sendSuccess(
          res,
          existing,
          `Friend request sent to ${targetName}! Rivalry challenge delivered.`,
          200
        );
      }
    }

    // Create new friend request with duplicate-key race condition resilience
    let friendship;
    try {
      friendship = await Friendship.create({
        requesterId: userId,
        recipientId: targetUserId,
        status: 'PENDING',
      });
    } catch (createErr: unknown) {
      const err = createErr as { code?: number };
      if (err?.code === 11000) {
        // Race condition / compound index hit: update existing record to pending
        friendship = await Friendship.findOneAndUpdate(
          {
            $or: [
              { requesterId: userId, recipientId: targetUserId },
              { requesterId: targetUserId, recipientId: userId },
            ],
          },
          {
            $set: {
              requesterId: userId,
              recipientId: targetUserId,
              status: 'PENDING',
            },
          },
          { new: true, upsert: true }
        );
      } else {
        throw createErr;
      }
    }

    // Deliver unified notification (in-app + web push) to recipient devices
    try {
      const recipientSubs = await PushSubscription.find({ userId: targetUserId });
      if (recipientSubs.length > 0) {
        for (const sub of recipientSubs) {
          await dispatchUnifiedNotification({
            sub,
            userId: targetUserId,
            title: 'New Friend Request! 🏆',
            body: `${senderName} challenged you to a streak rivalry on Taskiye!`,
            type: 'system',
            tag: `friend-request-${friendship._id}`,
            url: '/rank',
            data: { friendshipId: String(friendship._id) },
          });
        }
      } else {
        await dispatchUnifiedNotification({
          userId: targetUserId,
          title: 'New Friend Request! 🏆',
          body: `${senderName} challenged you to a streak rivalry on Taskiye!`,
          type: 'system',
          tag: `friend-request-${friendship._id}`,
          url: '/rank',
          data: { friendshipId: String(friendship._id) },
        });
      }
    } catch (notifErr) {
      console.warn('[Friends] Failed to deliver notification:', notifErr);
    }

    return sendSuccess(
      res,
      friendship,
      `Friend request sent to ${targetName}! Rivalry challenge delivered.`,
      201
    );
  } catch (error) {
    console.error('[Friends] Error in POST /request:', error);
    return sendError(res, 'Failed to send friend request', 500, error);
  }
});

/**
 * POST /api/friends/respond
 * Accept or reject a friend request
 */
router.post('/respond', socialLimiter, optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'guest_user';
    const { friendshipId, action } = req.body;

    if (!friendshipId) {
      return sendError(res, 'friendshipId is required', 400);
    }

    if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
      return sendError(res, "Action must be either 'ACCEPT' or 'REJECT'", 400);
    }

    const currentUserId = req.user?.id ? String(req.user.id) : '';
    const currentAltId = req.user && (req.user as unknown as { _id?: string })._id
      ? String((req.user as unknown as { _id?: string })._id)
      : currentUserId;
    const userIds = Array.from(new Set([currentUserId, currentAltId])).filter(Boolean);

    const nextStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

    const friendship = await Friendship.findOneAndUpdate(
      {
        _id: friendshipId,
        recipientId: { $in: userIds },
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

    // Invalidate rankings cache so Friends League updates immediately
    invalidateRankingsCache();

    if (action === 'ACCEPT') {
      try {
        const accepterName = req.user?.name || 'A friend';
        const requesterSubs = await PushSubscription.find({ userId: friendship.requesterId });
        if (requesterSubs.length > 0) {
          for (const sub of requesterSubs) {
            await dispatchUnifiedNotification({
              sub,
              userId: friendship.requesterId,
              title: 'Friend Request Accepted! ⚡',
              body: `${accepterName} accepted your friend request! View their streak on the leaderboard.`,
              type: 'system',
              tag: `friend-accepted-${friendship._id}`,
              url: '/rank',
            });
          }
        } else {
          await dispatchUnifiedNotification({
            userId: friendship.requesterId,
            title: 'Friend Request Accepted! ⚡',
            body: `${accepterName} accepted your friend request! View their streak on the leaderboard.`,
            type: 'system',
            tag: `friend-accepted-${friendship._id}`,
            url: '/rank',
          });
        }
      } catch (notifErr) {
        console.warn('[Friends] Failed to deliver accept notification:', notifErr);
      }
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

/**
 * POST /api/friends/remove
 * Remove a friend or cancel a pending request
 */
router.post('/remove', socialLimiter, optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
      ? String(req.user.id)
      : req.user && (req.user as unknown as { _id?: string })._id
        ? String((req.user as unknown as { _id?: string })._id)
        : '';

    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { friendshipId, targetUserId } = req.body;
    if (!friendshipId && !targetUserId) {
      return sendError(res, 'friendshipId or targetUserId is required', 400);
    }

    const currentAltId = req.user && (req.user as unknown as { _id?: string })._id
      ? String((req.user as unknown as { _id?: string })._id)
      : userId;
    const userIds = Array.from(new Set([userId, currentAltId])).filter(Boolean);

    const query: Record<string, unknown> = {};
    if (friendshipId) {
      query._id = friendshipId;
      query.$or = [{ requesterId: { $in: userIds } }, { recipientId: { $in: userIds } }];
    } else {
      const targetStr = String(targetUserId);
      query.$or = [
        { requesterId: { $in: userIds }, recipientId: targetStr },
        { requesterId: targetStr, recipientId: { $in: userIds } },
      ];
    }

    await Friendship.deleteMany(query);
    invalidateRankingsCache();

    return sendSuccess(res, null, 'Connection updated successfully');
  } catch (error) {
    console.error('[Friends] Error in POST /remove:', error);
    return sendError(res, 'Failed to remove connection', 500, error);
  }
});

export default router;
