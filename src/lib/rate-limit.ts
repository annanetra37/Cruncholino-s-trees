/**
 * T3.11 — rate limiting.
 *
 * A fixed-window counter held in process memory. That is honest about its
 * limits: with more than one Railway replica each replica keeps its own
 * counter, so the effective limit is `limit × replicas`. For v1, with a single
 * replica, it is enough to stop a runaway client from emptying the geocoding
 * budget. Swap the store for Redis (E9's optional `redis` service) when a
 * second replica appears — the interface below is the only thing that changes.
 */
import { env } from '@/env';
import { tooManyRequests } from '@/lib/api';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Keeps the map from growing without bound on a long-lived process. */
function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function consume(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { allowed: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Best-effort client address; Railway sits behind a proxy, so trust the header. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Applies both a per-user and a per-IP limit. The IP limit is what protects the
 * geocoding budget when someone scripts anonymous requests; the user limit is
 * what stops one signed-in account from doing the same.
 */
export function enforceWriteLimit(
  request: Request,
  userId: string | undefined,
  scope: string,
  limit = env.RATE_LIMIT_WRITES_PER_MINUTE,
) {
  const checks = [consume(`${scope}:ip:${clientIp(request)}`, limit)];
  if (userId) checks.push(consume(`${scope}:user:${userId}`, limit));

  const blocked = checks.find((check) => !check.allowed);
  if (blocked) {
    const seconds = Math.max(1, Math.ceil((blocked.resetAt - Date.now()) / 1000));
    throw tooManyRequests(`Rate limit reached. Try again in ${seconds}s.`);
  }
}

/** Test seam — the module-level map would otherwise leak between test cases. */
export function resetRateLimits() {
  buckets.clear();
}
