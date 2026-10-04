import { Request, Response, NextFunction, RequestHandler } from 'express';
import mongoose, { Schema } from 'mongoose';

/**
 * Fixed-window rate limiting stored in MongoDB. Unlike a process-local map this
 * is shared by every API instance using the same database. The small in-memory
 * fallback keeps local development usable while MongoDB is reconnecting.
 */
const memoryBuckets = new Map<string, { count: number; windowStart: number }>();

const RateLimitSchema = new Schema({
  key: { type: String, required: true },
  windowStart: { type: Number, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { versionKey: false });
RateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });
const RateLimitModel = mongoose.models.ApiRateLimit || mongoose.model('ApiRateLimit', RateLimitSchema);

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function countInMemory(key: string, windowStart: number): number {
  const existing = memoryBuckets.get(key);
  const bucket = !existing || existing.windowStart !== windowStart ? { count: 0, windowStart } : existing;
  bucket.count += 1;
  memoryBuckets.set(key, bucket);
  return bucket.count;
}

interface RateLimitOptions {
  max: number;
  windowMs: number;
  key: (req: Request) => string;
  message: string;
}

export function createRateLimiter({ max, windowMs, key: keyFn, message }: RateLimitOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = keyFn(req);
    let count: number;

    try {
      if (mongoose.connection.readyState !== 1) throw new Error('database unavailable');
      const bucket: any = await RateLimitModel.findOneAndUpdate(
        { key, windowStart },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs * 2) } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();
      count = bucket?.count || 0;
    } catch {
      count = countInMemory(key, windowStart);
    }

    const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((windowStart + windowMs) / 1000)));
    if (count > max) {
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message, retryAfter } });
      return;
    }
    next();
  };
}

/** General API limit per client IP. */
export const rateLimiter = createRateLimiter({
  max: 200,
  windowMs: 60_000,
  key: clientIp,
  message: 'Too many requests. Please slow down.',
});

/**
 * Credential endpoints (login, register, password reset): a small budget per IP + email slows
 * password guessing against one account, and a per-IP budget slows spraying across accounts.
 */
const perAccountAuthLimiter = createRateLimiter({
  max: 10,
  windowMs: 15 * 60_000,
  key: (req) => `auth:${req.path}:${clientIp(req)}:${String(req.body?.email || '').toLowerCase().trim()}`,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});
const perIpAuthLimiter = createRateLimiter({
  max: 50,
  windowMs: 15 * 60_000,
  key: (req) => `auth-ip:${clientIp(req)}`,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

export const authRateLimiter: RequestHandler = (req, res, next) =>
  perIpAuthLimiter(req, res, (err?: any) => (err ? next(err) : perAccountAuthLimiter(req, res, next)));
