import { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory token-bucket rate limiter.
 * Tracks requests per IP (or per-tenant if authenticated) with a sliding window.
 * Returns 429 Too Many Requests when the limit is exceeded.
 */

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, BucketEntry>();

// Configuration
const MAX_REQUESTS = 200;        // requests per window
const WINDOW_MS = 60 * 1000;     // 1 minute window
const REFILL_RATE = MAX_REQUESTS / (WINDOW_MS / 1000); // tokens per second

function getKey(req: Request): string {
  // Prefer tenant-scoped key if authenticated, else fall back to IP
  const tenantId = (req as any).tenant?.organizationId;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return tenantId ? `tenant:${tenantId}` : `ip:${ip}`;
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = getKey(req);
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: MAX_REQUESTS, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(MAX_REQUESTS, bucket.tokens + elapsed * REFILL_RATE);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
        retryAfterMs: Math.ceil((1 - bucket.tokens) / REFILL_RATE * 1000),
      },
    });
    return;
  }

  bucket.tokens -= 1;

  // Set rate-limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.floor(bucket.tokens));

  next();
}

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets.entries()) {
    if (now - entry.lastRefill > WINDOW_MS * 5) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);
