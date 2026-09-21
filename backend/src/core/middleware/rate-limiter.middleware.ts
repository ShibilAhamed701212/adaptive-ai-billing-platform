import { Request, Response, NextFunction } from 'express';
import mongoose, { Schema } from 'mongoose';

/**
 * Fixed-window rate limiting stored in MongoDB. Unlike a process-local map this
 * is shared by every API instance using the same database. The small in-memory
 * fallback keeps local development usable while MongoDB is reconnecting.
 */
const MAX_REQUESTS = 200;
const WINDOW_MS = 60_000;
const memoryBuckets = new Map<string, { count: number; windowStart: number }>();

const RateLimitSchema = new Schema({
  key: { type: String, required: true },
  windowStart: { type: Number, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { versionKey: false });
RateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });
const RateLimitModel = mongoose.models.ApiRateLimit || mongoose.model('ApiRateLimit', RateLimitSchema);

function keyFor(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function allowInMemory(key: string, windowStart: number): boolean {
  const existing = memoryBuckets.get(key);
  const bucket = !existing || existing.windowStart !== windowStart ? { count: 0, windowStart } : existing;
  bucket.count += 1;
  memoryBuckets.set(key, bucket);
  return bucket.count <= MAX_REQUESTS;
}

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const key = keyFor(req);
  let allowed: boolean;

  try {
    if (mongoose.connection.readyState !== 1) throw new Error('database unavailable');
    const bucket: any = await RateLimitModel.findOneAndUpdate(
      { key, windowStart },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + WINDOW_MS * 2) } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    allowed = (bucket?.count || 0) <= MAX_REQUESTS;
  } catch {
    allowed = allowInMemory(key, windowStart);
  }

  const retryAfter = Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1000));
  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil((windowStart + WINDOW_MS) / 1000)));
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.', retryAfter } });
    return;
  }
  next();
}
