import { Router, Response } from 'express';
import multer from 'multer';
import { put, del } from '@vercel/blob';
import { ObjectId } from 'mongodb';
import { mongoDb } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /api/users/avatar
 * Upload profile avatar to Vercel Blob, clean up old blob, and update user profile
 */
router.post(
  '/avatar',
  requireAuth,
  upload.single('avatar'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return sendError(res, 'No avatar file provided', 400);
      }

      const userId = req.user!.id;
      const fileExtension = req.file.originalname.split('.').pop() || 'png';
      const filename = `avatars/user-${userId}-${Date.now()}.${fileExtension}`;

      let queryFilter: Record<string, unknown> = { id: userId };
      try {
        queryFilter = {
          $or: [{ _id: new ObjectId(userId) }, { _id: userId }, { id: userId }],
        };
      } catch {
        queryFilter = {
          $or: [{ _id: userId }, { id: userId }],
        };
      }

      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

      // Clean up previous avatar blob from Vercel storage to prevent storage leaks
      const existingUser = await mongoDb.collection('user').findOne(queryFilter);
      const oldAvatarUrl = existingUser?.avatarUrl || existingUser?.image;

      if (
        blobToken &&
        oldAvatarUrl &&
        typeof oldAvatarUrl === 'string' &&
        oldAvatarUrl.includes('blob.vercel-storage.com')
      ) {
        try {
          await del(oldAvatarUrl, { token: blobToken });
        } catch (delErr) {
          console.warn('[Vercel Blob] Could not delete old avatar blob:', delErr);
        }
      }

      let avatarUrl = '';

      if (blobToken) {
        // Production Vercel Blob storage
        const blob = await put(filename, req.file.buffer, {
          access: 'public',
          token: blobToken,
          contentType: req.file.mimetype,
        });
        avatarUrl = blob.url;
      } else {
        // Fallback for local development if BLOB_READ_WRITE_TOKEN is not yet configured
        console.warn(
          '[Vercel Blob] BLOB_READ_WRITE_TOKEN is not defined. Using local base64 fallback for avatar.'
        );
        avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      await mongoDb.collection('user').updateOne(queryFilter, {
        $set: { avatarUrl, image: avatarUrl, updatedAt: new Date() },
      });

      return sendSuccess(
        res,
        { avatarUrl },
        'Profile avatar updated successfully'
      );
    } catch (error) {
      return sendError(res, 'Failed to upload avatar', 500, error);
    }
  }
);

/**
 * DELETE /api/users/avatar
 * Remove profile avatar, delete blob asset from Vercel storage, and reset to default
 */
router.delete('/avatar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let queryFilter: Record<string, unknown> = { id: userId };
    try {
      queryFilter = {
        $or: [{ _id: new ObjectId(userId) }, { _id: userId }, { id: userId }],
      };
    } catch {
      queryFilter = {
        $or: [{ _id: userId }, { id: userId }],
      };
    }

    const existingUser = await mongoDb.collection('user').findOne(queryFilter);
    const oldAvatarUrl = existingUser?.avatarUrl || existingUser?.image;

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (
      blobToken &&
      oldAvatarUrl &&
      typeof oldAvatarUrl === 'string' &&
      oldAvatarUrl.includes('blob.vercel-storage.com')
    ) {
      try {
        await del(oldAvatarUrl, { token: blobToken });
      } catch (delErr) {
        console.warn('[Vercel Blob] Could not delete old avatar blob:', delErr);
      }
    }

    await mongoDb.collection('user').updateOne(queryFilter, {
      $set: { avatarUrl: '', image: '', updatedAt: new Date() },
    });

    return sendSuccess(res, { avatarUrl: '' }, 'Profile avatar removed successfully');
  } catch (error) {
    return sendError(res, 'Failed to remove avatar', 500, error);
  }
});

/**
 * GET /api/users/profile
 * Retrieve current user profile from database
 */
router.get('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let queryFilter: Record<string, unknown> = { id: userId };
    try {
      queryFilter = {
        $or: [{ _id: new ObjectId(userId) }, { _id: userId }, { id: userId }],
      };
    } catch {
      queryFilter = {
        $or: [{ _id: userId }, { id: userId }],
      };
    }

    const user = await mongoDb.collection('user').findOne(queryFilter);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(
      res,
      {
        user: {
          id: user.id || user._id?.toString(),
          name: user.name || '',
          username: user.username || '',
          email: user.email || '',
          avatarUrl: user.avatarUrl || user.image || '',
          phoneNumber: user.phoneNumber || '',
        },
      },
      'Profile retrieved successfully'
    );
  } catch (error) {
    return sendError(res, 'Failed to fetch user profile', 500, error);
  }
});

/**
 * PUT /api/users/profile
 * Update user display name, username, and OTP phone number
 */
router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, username, phoneNumber, avatarUrl } = req.body;

    let queryFilter: Record<string, unknown> = { id: userId };
    try {
      queryFilter = {
        $or: [{ _id: new ObjectId(userId) }, { _id: userId }, { id: userId }],
      };
    } catch {
      queryFilter = {
        $or: [{ _id: userId }, { id: userId }],
      };
    }

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (typeof name === 'string' && name.trim()) updateFields.name = name.trim();
    if (typeof username === 'string') updateFields.username = username.trim();
    if (typeof phoneNumber === 'string') updateFields.phoneNumber = phoneNumber.trim();
    if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
      updateFields.avatarUrl = avatarUrl.trim();
      updateFields.image = avatarUrl.trim();
    }

    await mongoDb.collection('user').updateOne(queryFilter, {
      $set: updateFields,
    });

    const updatedUser = await mongoDb.collection('user').findOne(queryFilter);

    return sendSuccess(res, { user: updatedUser }, 'Profile updated successfully');
  } catch (error) {
    return sendError(res, 'Failed to update user profile', 500, error);
  }
});

export default router;

