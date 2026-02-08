/**
 * In-memory token bucket rate limiter.
 * 60 requests per minute per IP, with automatic cleanup of stale entries.
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const RATE_LIMIT = 60;       // requests per window
const WINDOW_MS = 60_000;    // 1 minute
const CLEANUP_INTERVAL = 5 * 60_000; // clean stale entries every 5 min

const buckets = new Map<string, TokenBucket>();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const staleThreshold = now - WINDOW_MS * 2;
  for (const [key, bucket] of buckets) {
    if (bucket.lastRefill < staleThreshold) {
      buckets.delete(key);
    }
  }
}

/**
 * Check rate limit for an IP. Returns { allowed, remaining, retryAfterMs }.
 */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
} {
  cleanup();
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: RATE_LIMIT, lastRefill: now };
    buckets.set(ip, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor((elapsed / WINDOW_MS) * RATE_LIMIT);
  if (refill > 0) {
    bucket.tokens = Math.min(RATE_LIMIT, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens--;
    return { allowed: true, remaining: bucket.tokens, retryAfterMs: 0 };
  }

  // Calculate when next token is available
  const msPerToken = WINDOW_MS / RATE_LIMIT;
  const retryAfterMs = msPerToken - elapsed;

  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: Math.max(retryAfterMs, 1000),
  };
}
