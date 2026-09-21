import { Router, Request, Response } from 'express';
import multer from 'multer';
import { put, del } from '@vercel/blob';
import { ObjectId } from 'mongodb';
import { mongoDb } from '../db/connection.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { auth } from '../lib/auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { validateEmailAddress } from '../lib/emailValidation.js';

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

    // Query accounts to determine if user has a password or Google OAuth
    const accounts = await mongoDb
      .collection('account')
      .find({
        $or: [{ userId: userId }, { userId: user.id }, { userId: String(user._id) }],
      })
      .toArray();

    const hasPassword = accounts.some(
      (a) => Boolean(a.password) || a.providerId === 'credential'
    );
    const providers = Array.from(new Set(accounts.map((a) => a.providerId).filter(Boolean)));

    return sendSuccess(
      res,
      {
        user: {
          id: user.id || user._id?.toString(),
          name: user.name || '',
          username: user.username || '',
          email: user.email || '',
          emailVerified: Boolean(user.emailVerified),
          hasPassword,
          providers,
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

router.post(
  '/send-verification-email',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      if (!email) {
        return sendError(res, 'No email registered on account', 400);
      }

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
      if (user?.emailVerified) {
        return sendSuccess(res, { alreadyVerified: true }, 'Email is already verified');
      }

      const origin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
      const callbackURL = `${origin}/?email_verified=true`;

      // Trigger verification email via Better Auth
      await auth.api.sendVerificationEmail({
        body: {
          email,
          callbackURL,
        },
        headers: fromNodeHeaders(req.headers),
      });

      return sendSuccess(
        res,
        { email },
        `Verification email sent to ${email}. Please check your inbox!`
      );
    } catch (error) {
      return sendError(res, 'Failed to send verification email', 500, error);
    }
  }
);

router.post(
  '/change-email-request',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { newEmail, currentPassword } = req.body;
      if (!newEmail || typeof newEmail !== 'string' || !newEmail.includes('@')) {
        return sendError(res, 'A valid new email address is required', 400);
      }

      const cleanNewEmail = newEmail.trim().toLowerCase();
      const emailValidation = validateEmailAddress(cleanNewEmail);
      if (!emailValidation.isValid) {
        return sendError(res, emailValidation.error || 'Invalid email address', 400);
      }

      if (cleanNewEmail === req.user!.email.toLowerCase()) {
        return sendError(res, 'New email must be different from current email', 400);
      }

      // Check if new email is already used by another account
      const existingUser = await mongoDb.collection('user').findOne({ email: cleanNewEmail });
      if (existingUser) {
        return sendError(res, 'An account with this email address already exists', 409);
      }

      const userId = req.user!.id;
      // Check if user has a password-based credential account
      const accounts = await mongoDb
        .collection('account')
        .find({
          $or: [{ userId: userId }, { userId: String(userId) }],
        })
        .toArray();

      const hasPassword = accounts.some(
        (a) => Boolean(a.password) || a.providerId === 'credential'
      );

      // If user has a password, verify it strictly before proceeding
      if (hasPassword) {
        if (!currentPassword || typeof currentPassword !== 'string') {
          return sendError(
            res,
            'Current password is required to confirm changing your email',
            400
          );
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const verifyRes: any = await auth.api.verifyPassword({
            body: { password: currentPassword },
            headers: fromNodeHeaders(req.headers),
          });

          if (verifyRes?.status === false) {
            return sendError(res, 'Incorrect current password. Verification failed.', 401);
          }
        } catch {
          return sendError(res, 'Incorrect current password. Verification failed.', 401);
        }
      }

      const origin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
      const callbackURL = `${origin}/?email_changed=true`;

      // Trigger change email verification via Better Auth
      await auth.api.changeEmail({
        body: {
          newEmail: cleanNewEmail,
          callbackURL,
        },
        headers: fromNodeHeaders(req.headers),
      });

      return sendSuccess(
        res,
        { newEmail: cleanNewEmail },
        `Verification email sent to ${cleanNewEmail}. Please click the confirmation link to complete the change.`
      );
    } catch (error) {
      return sendError(res, 'Failed to request email change', 500, error);
    }
  }
);

router.post('/validate-email', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  const validation = validateEmailAddress(email);
  if (!validation.isValid) {
    return sendError(res, validation.error || 'Invalid email address', 400);
  }
  return sendSuccess(res, { isValid: true });
});

router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, username, avatarUrl } = req.body;

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


