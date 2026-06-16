import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Boot regression test for the SEC-04 Redis-backed rate limiter.
 *
 * Bug: when REDIS_URL is set, importing rateLimiter triggered an
 * unhandled rejection during server boot:
 *
 *   Error: Stream isn't writeable and enableOfflineQueue options
 *   is false
 *     at RedisStore.loadIncrementScript (rate-limit-redis)
 *     at new RedisStore (rate-limit-redis)
 *     at makeStore (rateLimiter.ts)
 *
 * Root cause: getRedisClient() created the ioredis client with
 * enableOfflineQueue:false. The rate-limit-redis RedisStore
 * constructor synchronously calls loadIncrementScript() which
 * sendCommand()s the EVAL SHA before the TCP connection is
 * established. With offline queue disabled, ioredis throws
 * immediately and the server's unhandledRejection handler
 * shuts the process down.
 *
 * Fix: enableOfflineQueue must be true (the ioredis default) so
 * commands queued before connection ready flush on connect.
 *
 * This test forces the import path with REDIS_URL set and
 * verifies no unhandled rejection fires within 200ms. With the
 * bug present, the rejection fires within microseconds.
 */

const ORIGINAL_REDIS_URL = process.env.REDIS_URL;

describe('rateLimiter boot path with REDIS_URL set', () => {
  beforeEach(() => {
    vi.resetModules();
    // Point at a non-listening port so the connection cannot
    // possibly establish before the synchronous RedisStore
    // constructor runs. This deterministically reproduces the
    // race that the original bug exhibited even against a
    // healthy local Redis: the offline-queue path must work.
    process.env.REDIS_URL = 'redis://127.0.0.1:65530';
  });

  afterEach(() => {
    if (ORIGINAL_REDIS_URL === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = ORIGINAL_REDIS_URL;
    }
    vi.resetModules();
  });

  it('does not produce an unhandled rejection at module load', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);

    try {
      await import('app/middleware/rateLimiter/rateLimiter.js');
      // Give any synchronous-but-async rejections a chance to fire.
      await new Promise((resolve) => setTimeout(resolve, 200));
    } finally {
      process.off('unhandledRejection', onRejection);
    }

    if (rejections.length > 0) {
      const messages = rejections
        .map((r) => (r instanceof Error ? r.message : JSON.stringify(r)))
        .join('; ');
      expect.fail(
        `Expected no unhandled rejections during rateLimiter boot, got: ${messages}`,
      );
    }
    expect(rejections).toEqual([]);
  });
});
