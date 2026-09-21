import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
}

// In-memory store for rate limiting with zero external dependencies
class InMemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private sweepInterval: NodeJS.Timeout;

  constructor() {
    this.sweepInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (record.resetTime <= now) {
          this.store.delete(key);
        }
      }
    }, 2 * 60 * 1000);

    if (this.sweepInterval.unref) {
      this.sweepInterval.unref();
    }
  }

  public createMiddleware(options: RateLimitOptions) {
    const {
      windowMs,
      max,
      message = 'Too many requests, please try again later.',
      keyGenerator = (req: Request) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = typeof forwarded === 'string'
          ? forwarded.split(',')[0]?.trim() || '127.0.0.1'
          : req.socket?.remoteAddress || '127.0.0.1';
        return `${req.baseUrl || req.path}:${ip}`;
      },
    } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
      const now = Date.now();
      const key = keyGenerator(req);
      const record = this.store.get(key);

      if (!record || record.resetTime <= now) {
        const resetTime = now + windowMs;
        this.store.set(key, { count: 1, resetTime });

        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(max - 1));
        res.setHeader('RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
        return next();
      }

      if (record.count >= max) {
        const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', '0');
        res.setHeader('RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));
        res.setHeader('Retry-After', String(retryAfterSeconds));

        sendError(res, message, 429, { retryAfterSeconds });
        return;
      }

      record.count += 1;
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, max - record.count)));
      res.setHeader('RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));
      return next();
    };
  }
}

export const rateLimiterManager = new InMemoryRateLimiter();

const baseAuthLimiter = rateLimiterManager.createMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please wait a few minutes before trying again.',
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim() || '127.0.0.1'
      : req.socket?.remoteAddress || '127.0.0.1';
    const email = req.body?.email ? `:${String(req.body.email).toLowerCase()}` : '';
    return `auth:${ip}${email}`;
  },
});

export const authLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const isReadOnlyOrSession =
    req.method === 'GET' ||
    req.originalUrl.includes('get-session') ||
    req.originalUrl.includes('/session') ||
    req.originalUrl.includes('/ok') ||
    req.originalUrl.includes('sign-out');

  if (isReadOnlyOrSession) {
    return next();
  }

  return baseAuthLimiter(req, res, next);
};

export const socialLimiter = rateLimiterManager.createMiddleware({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: 'You have sent too many friend requests recently. Please wait a few minutes.',
  keyGenerator: (req) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (userId) return `social:user:${userId}`;
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim() || '127.0.0.1'
      : req.socket?.remoteAddress || '127.0.0.1';
    return `social:ip:${ip}`;
  },
});

export const searchLimiter = rateLimiterManager.createMiddleware({
  windowMs: 60 * 1000,
  max: 90,
  message: 'Search rate limit exceeded. Please wait a moment.',
});

export const generalApiLimiter = rateLimiterManager.createMiddleware({
  windowMs: 60 * 1000,
  max: 250,
  message: 'Too many requests across the API. Please slow down.',
});
