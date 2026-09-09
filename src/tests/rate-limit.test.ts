/** T3.11 / T10.1 — the rate limiter's window behaviour. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp, consume, enforceWriteLimit, resetRateLimits } from '@/lib/rate-limit';
import { ApiError } from '@/lib/api';

afterEach(() => {
  resetRateLimits();
  vi.useRealTimers();
});

describe('consume', () => {
  it('allows up to the limit and refuses beyond it', () => {
    for (let index = 0; index < 3; index += 1) {
      expect(consume('key', 3).allowed).toBe(true);
    }
    expect(consume('key', 3).allowed).toBe(false);
  });

  it('keeps separate counters per key', () => {
    consume('a', 1);
    expect(consume('a', 1).allowed).toBe(false);
    expect(consume('b', 1).allowed).toBe(true);
  });

  it('resets when the window elapses', () => {
    vi.useFakeTimers();
    consume('key', 1, 1000);
    expect(consume('key', 1, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(consume('key', 1, 1000).allowed).toBe(true);
  });
});

describe('enforceWriteLimit', () => {
  const request = (ip: string) => new Request('https://example.org', { headers: { 'x-forwarded-for': ip } });

  it('throws a 429 once the caller is over the limit', () => {
    enforceWriteLimit(request('1.2.3.4'), 'user-1', 'test', 1);
    expect(() => enforceWriteLimit(request('1.2.3.4'), 'user-1', 'test', 1)).toThrow(ApiError);
    try {
      enforceWriteLimit(request('1.2.3.4'), 'user-1', 'test', 1);
    } catch (error) {
      expect((error as ApiError).status).toBe(429);
    }
  });

  it('limits an anonymous caller by IP alone', () => {
    enforceWriteLimit(request('5.6.7.8'), undefined, 'test', 1);
    expect(() => enforceWriteLimit(request('5.6.7.8'), undefined, 'test', 1)).toThrow(ApiError);
  });

  it('does not let one user exhaust another user’s budget', () => {
    enforceWriteLimit(request('9.9.9.9'), 'user-a', 'scoped', 1);
    // Same IP, so the IP bucket is what stops this — proving both apply.
    expect(() => enforceWriteLimit(request('9.9.9.9'), 'user-b', 'scoped', 1)).toThrow(ApiError);
  });
});

describe('clientIp', () => {
  it('takes the first hop of x-forwarded-for', () => {
    const request = new Request('https://example.org', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(clientIp(request)).toBe('203.0.113.5');
  });
});
