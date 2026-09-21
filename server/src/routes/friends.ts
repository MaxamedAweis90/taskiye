import { Router, Response } from 'express';
import { ObjectId } from 'mongodb';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { Friendship } from '../models/Friendship.js';
import { Habit } from '../models/Habit.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { InAppNotification } from '../models/InAppNotification.js';
import { sendPushNotification } from '../lib/push.js';
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

    const currentUsername = req.user?.username ? String(req.user.username) : '';
    const currentName = req.user?.name ? String(req.user.name) : '';
    const currentEmail = req.user?.email ? String(req.user.email) : '';
    const currentCleanHandle = (currentUsername || currentName.toLowerCase().replace(/\s+/g, '')).replace(/^@/, '');

    const userIds = Array.from(
      new Set([
        currentUserId,
        currentAltId,
        currentUsername,
        currentName,
        currentEmail,
        currentCleanHandle,
        `@${currentCleanHandle}`,
      ])
    ).filter(Boolean);

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
      { username: { $in: otherIdsArray } },
      { name: { $in: otherIdsArray } },
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
      if (u.username) userMap.set(String(u.username).toLowerCase(), obj);
      if (u.name) userMap.set(String(u.name).toLowerCase(), obj);
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
        requesterId: String(f.requesterId),
        recipientId: String(f.recipientId),
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
 * Deliver friend request notification:
 * 1. Creates exactly ONE in-app notification in MongoDB with friendshipId and tag
 * 2. Sends native Web Push to all active devices registered under any of recipient's aliases
 */
async function deliverFriendRequestNotification(
  targetUserId: string,
  targetUserDoc: Record<string, unknown>,
  senderName: string,
  friendshipId: string
) {
  try {
    const targetUserIds = Array.from(
      new Set([
        targetUserId,
        targetUserDoc.id ? String(targetUserDoc.id) : null,
        targetUserDoc._id ? targetUserDoc._id.toString() : null,
        targetUserDoc.username ? String(targetUserDoc.username) : null,
        targetUserDoc.email ? String(targetUserDoc.email) : null,
      ])
    ).filter(Boolean) as string[];

    // 1. Create a single in-app notification in database
    await InAppNotification.create({
      userId: targetUserId,
      title: 'New Friend Request! 🏆',
      body: `${senderName} challenged you to a streak rivalry on Taskiye!`,
      type: 'system',
      data: {
        url: '/rank',
        tag: `friend-request-${friendshipId}`,
        friendshipId: String(friendshipId),
      },
      isRead: false,
    });

    // 2. Query all active push subscriptions for the recipient across all aliases
    const recipientSubs = await PushSubscription.find({ userId: { $in: targetUserIds } });
    for (const sub of recipientSubs) {
      await sendPushNotification(sub, {
        title: 'New Friend Request! 🏆',
        body: `${senderName} challenged you to a streak rivalry on Taskiye!`,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `friend-request-${friendshipId}`,
        data: {
          url: '/rank',
          type: 'system',
          friendshipId: String(friendshipId),
        },
      });
    }
  } catch (notifErr) {
    console.warn('[Friends] Failed to deliver notification:', notifErr);
  }
}

/**
 * Deliver friend accepted notification:
 * 1. Creates exactly ONE in-app notification in MongoDB
 * 2. Sends native Web Push to all active devices registered for the requester
 */
async function deliverFriendAcceptedNotification(
  requesterId: string,
  accepterName: string,
  friendshipId: string
) {
  try {
    const requesterIds = [requesterId];
    if (ObjectId.isValid(requesterId)) {
      const u = await mongoDb.collection('user').findOne({ _id: new ObjectId(requesterId) });
      if (u) {
        if (u.id) requesterIds.push(String(u.id));
        if (u.username) requesterIds.push(String(u.username));
        if (u.email) requesterIds.push(String(u.email));
      }
    }

    // 1. Create a single in-app notification
    await InAppNotification.create({
      userId: requesterId,
      title: 'Friend Request Accepted! ⚡',
      body: `${accepterName} accepted your friend request! View their streak on the leaderboard.`,
      type: 'system',
      data: {
        url: '/rank',
        tag: `friend-accepted-${friendshipId}`,
        friendshipId: String(friendshipId),
      },
      isRead: false,
    });

    // 2. Push to all requester subscriptions across all aliases
    const requesterSubs = await PushSubscription.find({ userId: { $in: requesterIds } });
    for (const sub of requesterSubs) {
      await sendPushNotification(sub, {
        title: 'Friend Request Accepted! ⚡',
        body: `${accepterName} accepted your friend request! View their streak on the leaderboard.`,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `friend-accepted-${friendshipId}`,
        data: {
          url: '/rank',
          type: 'system',
          friendshipId: String(friendshipId),
        },
      });
    }
  } catch (notifErr) {
    console.warn('[Friends] Failed to deliver accept notification:', notifErr);
  }
}

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

    // Comprehensive alias sets for both sender and target
    const senderAliases = Array.from(
      new Set([
        userId,
        req.user?.id ? String(req.user.id) : null,
        req.user && (req.user as unknown as { _id?: string })._id
          ? String((req.user as unknown as { _id?: string })._id)
          : null,
        req.user?.username ? String(req.user.username) : null,
        req.user?.email ? String(req.user.email) : null,
      ])
    ).filter(Boolean) as string[];

    const targetAliases = Array.from(
      new Set([
        targetUserId,
        targetUserDoc.id ? String(targetUserDoc.id) : null,
        targetUserDoc._id ? targetUserDoc._id.toString() : null,
        targetUserDoc.username ? String(targetUserDoc.username) : null,
        targetUserDoc.email ? String(targetUserDoc.email) : null,
      ])
    ).filter(Boolean) as string[];

    // Symmetrical self-request check
    if (targetAliases.some((alias) => senderAliases.includes(alias))) {
      return sendError(
        res,
        "That's your own profile! Share your QR code or handle with a friend to connect.",
        400
      );
    }

    // Check if a friendship relationship already exists in either direction
    const existing = await Friendship.findOne({
      $or: [
        { requesterId: { $in: senderAliases }, recipientId: { $in: targetAliases } },
        { requesterId: { $in: targetAliases }, recipientId: { $in: senderAliases } },
      ],
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return sendSuccess(res, existing, `You are already connected with ${targetName}!`, 200);
      }

      if (existing.status === 'PENDING') {
        // Mutual request detection: if the other user already invited the requester, auto-accept immediately!
        if (senderAliases.includes(String(existing.recipientId))) {
          existing.status = 'ACCEPTED';
          await existing.save();
          invalidateRankingsCache();

          // Mark incoming request notification as read
          await InAppNotification.updateMany(
            {
              $or: [
                { 'data.friendshipId': String(existing._id) },
                { 'data.tag': `friend-request-${existing._id}` },
              ],
            },
            { $set: { isRead: true } }
          ).catch(() => {});

          await deliverFriendAcceptedNotification(targetUserId, senderName, String(existing._id));

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
        invalidateRankingsCache();

        await deliverFriendRequestNotification(targetUserId, targetUserDoc, senderName, String(existing._id));

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
              { requesterId: { $in: senderAliases }, recipientId: { $in: targetAliases } },
              { requesterId: { $in: targetAliases }, recipientId: { $in: senderAliases } },
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
    await deliverFriendRequestNotification(targetUserId, targetUserDoc, senderName, String(friendship._id));

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

    const currentUsername = req.user?.username ? String(req.user.username) : '';
    const currentName = req.user?.name ? String(req.user.name) : '';
    const currentEmail = req.user?.email ? String(req.user.email) : '';
    const currentCleanHandle = (currentUsername || currentName.toLowerCase().replace(/\s+/g, '')).replace(/^@/, '');

    const userIds = Array.from(
      new Set([
        currentUserId,
        currentAltId,
        currentUsername,
        currentName,
        currentEmail,
        currentCleanHandle,
        `@${currentCleanHandle}`,
      ])
    ).filter(Boolean);

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

    // Mark matching friend request in-app notification as read
    await InAppNotification.updateMany(
      {
        $or: [
          { 'data.friendshipId': String(friendshipId) },
          { 'data.tag': `friend-request-${friendshipId}` },
        ],
      },
      { $set: { isRead: true } }
    ).catch(() => {});

    if (action === 'ACCEPT') {
      const accepterName = req.user?.name || req.user?.username || 'A friend';
      await deliverFriendAcceptedNotification(String(friendship.requesterId), accepterName, String(friendship._id));
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
 * Remove a friend or cancel a pending request (Unconnect / Disconnect)
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
    const currentUsername = (req.user as unknown as { username?: string })?.username || '';
    const currentName = req.user?.name || '';
    const currentEmail = req.user?.email || '';

    const userIds = Array.from(
      new Set([
        userId,
        currentAltId,
        currentUsername,
        currentName,
        currentEmail,
      ])
    ).filter(Boolean);

    // Build query with full target user alias resolution
    const query: Record<string, unknown> = {};
    if (friendshipId) {
      query._id = friendshipId;
      query.$or = [{ requesterId: { $in: userIds } }, { recipientId: { $in: userIds } }];
    } else {
      const cleanTarget = String(targetUserId).trim();
      const targetUserIds = [cleanTarget];

      // Resolve all target user aliases from database
      const queryOr: Record<string, unknown>[] = [
        { id: cleanTarget },
        { username: cleanTarget },
        { name: cleanTarget },
        { email: cleanTarget.toLowerCase() },
      ];
      if (ObjectId.isValid(cleanTarget)) {
        queryOr.push({ _id: new ObjectId(cleanTarget) });
      }

      const tDoc = await mongoDb.collection('user').findOne({ $or: queryOr });
      if (tDoc) {
        if (tDoc._id) targetUserIds.push(tDoc._id.toString());
        if (tDoc.id) targetUserIds.push(String(tDoc.id));
        if (tDoc.username) targetUserIds.push(String(tDoc.username));
        if (tDoc.name) targetUserIds.push(String(tDoc.name));
        if (tDoc.email) targetUserIds.push(String(tDoc.email));
      }

      const targetAliases = Array.from(new Set(targetUserIds)).filter(Boolean);
      query.$or = [
        { requesterId: { $in: userIds }, recipientId: { $in: targetAliases } },
        { requesterId: { $in: targetAliases }, recipientId: { $in: userIds } },
      ];
    }

    // Find doomed friendships first to collect their IDs for notification cleanup
    const doomed = await Friendship.find(query).lean();
    const doomedIds = doomed.map((f) => String(f._id));

    await Friendship.deleteMany(query);
    invalidateRankingsCache();

    // Clean up or purge notifications tied to these severed friendships
    if (doomedIds.length > 0) {
      await InAppNotification.deleteMany({
        $or: [
          { 'data.friendshipId': { $in: doomedIds } },
          { 'data.tag': { $in: doomedIds.map((id) => `friend-request-${id}`) } },
          { 'data.tag': { $in: doomedIds.map((id) => `friend-accepted-${id}`) } },
        ],
      }).catch(() => {});
    }

    return sendSuccess(res, null, 'Connection updated successfully');
  } catch (error) {
    console.error('[Friends] Error in POST /remove:', error);
    return sendError(res, 'Failed to remove connection', 500, error);
  }
});

export default router;
