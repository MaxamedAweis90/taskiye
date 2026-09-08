import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth.js';
import { sendError } from '../utils/response.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  session?: Record<string, unknown>;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionData || !sessionData.user) {
      sendError(res, 'Unauthorized: Valid session required', 401);
      return;
    }

    req.user = sessionData.user as AuthenticatedUser;
    req.session = sessionData.session as Record<string, unknown>;
    next();
  } catch (error) {
    sendError(res, 'Authentication verification failed', 401, error);
  }
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (sessionData && sessionData.user) {
      req.user = sessionData.user as AuthenticatedUser;
      req.session = sessionData.session as Record<string, unknown>;
    }
  } catch {
    // Soft auth fails gracefully for guests
  }
  next();
}
