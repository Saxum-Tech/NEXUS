/**
 * lib/auth/__tests__/rate-limit.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limit';

// Reset the in-memory store between tests by using unique keys per test.
let testId = 0;
function key(suffix = '') {
  return `test-${testId}-${suffix}`;
}

beforeEach(() => {
  testId++;
});

describe('checkRateLimit', () => {
  it('allows requests within the limit', () => {
    const opts = { max: 3, windowMs: 60_000 };
    expect(checkRateLimit(key(), opts).ok).toBe(true);
    expect(checkRateLimit(key(), opts).ok).toBe(true);
    expect(checkRateLimit(key(), opts).ok).toBe(true);
  });

  it('blocks when limit is exceeded', () => {
    const opts = { max: 2, windowMs: 60_000 };
    const k = key();
    checkRateLimit(k, opts);
    checkRateLimit(k, opts);
    const result = checkRateLimit(k, opts);
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts remaining correctly', () => {
    const opts = { max: 5, windowMs: 60_000 };
    const k = key();
    const r1 = checkRateLimit(k, opts);
    expect(r1.remaining).toBe(4);
    const r2 = checkRateLimit(k, opts);
    expect(r2.remaining).toBe(3);
  });

  it('CRITICAL: isolates counters per key', () => {
    const opts = { max: 1, windowMs: 60_000 };
    // Exhaust key A
    checkRateLimit(key('a'), opts);
    expect(checkRateLimit(key('a'), opts).ok).toBe(false);
    // Key B is independent — should still be allowed
    expect(checkRateLimit(key('b'), opts).ok).toBe(true);
  });

  it('allows requests again after the window expires', async () => {
    const opts = { max: 1, windowMs: 50 }; // 50ms window
    const k = key();
    checkRateLimit(k, opts); // use up the 1 slot
    expect(checkRateLimit(k, opts).ok).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    // Window has elapsed — should be allowed again
    expect(checkRateLimit(k, opts).ok).toBe(true);
  });
});
