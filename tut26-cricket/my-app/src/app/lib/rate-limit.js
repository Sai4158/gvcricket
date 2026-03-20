const globalStore = globalThis.__gvRateLimitStore || new Map();
globalThis.__gvRateLimitStore = globalStore;

function getBucket(key, now) {
  const existing = globalStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 0, resetAt: now };
    globalStore.set(key, fresh);
    return fresh;
  }

  return existing;
}

export function enforceRateLimit({
  key,
  limit,
  windowMs,
  blockMs = 0,
  now = Date.now(),
}) {
  const bucket = getBucket(key, now);

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterMs: bucket.blockedUntil - now,
    };
  }

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
    delete bucket.blockedUntil;
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    if (blockMs > 0) {
      bucket.blockedUntil = now + blockMs;
    }

    return {
      allowed: false,
      retryAfterMs: (bucket.blockedUntil || bucket.resetAt) - now,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}
