/**
 * lib/auth/rate-limit.ts
 * ─────────────────────────────────────────────────────────────
 * Sliding-window rate limiter for auth Route Handlers.
 *
 * Uses an in-process Map — no Redis or external dependency
 * needed, which keeps the template self-contained. The
 * trade-off: limits are per-process, so in a multi-instance
 * deployment each instance has its own counter. For most
 * single-tenant enterprise deployments (1–2 instances) this
 * is perfectly adequate. If you need distributed rate limiting,
 * swap the Map for an Upstash Redis client — the call sites
 * don't change.
 *
 * Usage in a Route Handler:
 *
 *   const limit = await rateLimit(request, 'login', { max: 10, windowMs: 60_000 });
 *   if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';

interface WindowEntry {
  timestamps: number[];
}

// Module-level store. Persists for the lifetime of the process.
const store = new Map<string, WindowEntry>();

// Prune stale keys every 5 minutes to avoid unbounded memory growth.
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let lastPrune = Date.now();

function prune(windowMs: number): void {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;

  for (const [key, entry] of store.entries()) {
    const cutoff = now - windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. */
  max: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Seconds until the window resets (only meaningful when ok === false). */
  retryAfterSeconds: number;
}

/**
 * Checks and records a rate-limit hit for the given key (typically
 * `${action}:${ip}`). Returns { ok: true } if the request is within
 * the limit, or { ok: false, retryAfterSeconds } if it's exceeded.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const { max, windowMs } = options;
  const now = Date.now();
  const cutoff = now - windowMs;

  prune(windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the current window.
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0] ?? now;
    const retryAfterMs = oldest + windowMs - now;
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  entry.timestamps.push(now);

  return {
    ok: true,
    remaining: max - entry.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Convenience wrapper that extracts the client IP from a Request
 * and checks the rate limit. Use this in Route Handlers.
 */
export function rateLimitRequest(
  request: Request,
  action: string,
  options: RateLimitOptions
): RateLimitResult {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  return checkRateLimit(`${action}:${ip}`, options);
}
