import { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  statusCode: number;
  body: unknown;
  expiresAt: number;
}

class IdempotencyManager {
  private store = new Map<string, CachedResponse>();
  private sweepInterval: NodeJS.Timeout | null = null;
  private ttlMs: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
    this.sweepInterval = setInterval(() => this.sweep(), 60 * 1000);
    if (this.sweepInterval.unref) {
      this.sweepInterval.unref();
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Only process mutation methods that alter state
      if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
        return next();
      }

      const idempotencyKey = (
        (req.headers['idempotency-key'] as string | undefined) ||
        (req.headers['x-idempotency-key'] as string | undefined)
      )?.trim();

      if (!idempotencyKey) {
        return next();
      }

      const userId = (req as Request & { user?: { id: string } }).user?.id || req.ip || 'anonymous';
      const storageKey = `${req.baseUrl || req.path}:${userId}:${idempotencyKey}`;
      const cached = this.store.get(storageKey);

      if (cached && cached.expiresAt > Date.now()) {
        res.setHeader('X-Cache-Lookup', 'IDEMPOTENT-HIT');
        res.status(cached.statusCode).json(cached.body);
        return;
      }

      // Intercept res.json to capture response
      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        // Cache successful or client-side responses (status < 500)
        if (res.statusCode < 500) {
          this.store.set(storageKey, {
            statusCode: res.statusCode,
            body,
            expiresAt: Date.now() + this.ttlMs,
          });
        }
        return originalJson(body);
      };

      return next();
    };
  }
}

export const idempotencyManager = new IdempotencyManager();
export const idempotency = idempotencyManager.middleware();
