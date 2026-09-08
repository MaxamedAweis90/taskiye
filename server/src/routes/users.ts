import { Router, Response } from 'express';
import multer from 'multer';
import { put } from '@vercel/blob';
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
 * Upload profile avatar to Vercel Blob and update user profile
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

      let avatarUrl = '';

      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
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

      // Update Better Auth User document in MongoDB
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

      await mongoDb.collection('user').updateOne(queryFilter, {
        $set: { avatarUrl, updatedAt: new Date() },
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

export default router;
