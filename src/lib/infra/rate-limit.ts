interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    maybeCleanupBuckets(now);
    return { success: true, remaining: limit - 1, resetAt };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { success: false, remaining: 0, resetAt: bucket.resetAt };
  }

  return { success: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

function maybeCleanupBuckets(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function rateLimitForPath(pathname: string): { limit: number; windowMs: number } | null {
  if (!pathname.startsWith("/api/")) return null;
  return { limit: 120, windowMs: 60_000 };
}
