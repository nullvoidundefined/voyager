import rateLimit, { type Store } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import { logger } from 'app/clients/logger.js';
import { getRedis } from 'app/clients/redis.js';
import { isProduction } from 'app/config/env.js';

/**
 * Returns true when the request should bypass rate limiting.
 * E2E suites set E2E_BYPASS_RATE_LIMITS=1 because they seed
 * dozens of users and trips per run from a single IP and would
 * otherwise hit the 10-per-15-min auth limit immediately. The
 * unit and integration tests do NOT set this flag, so they
 * still exercise the limiter behavior.
 */
function shouldBypass(): boolean {
  return process.env.E2E_BYPASS_RATE_LIMITS === '1';
}

function makeStore(prefix: string): Store | undefined {
  const client = getRedis();
  if (!client) {
    if (isProduction()) {
      logger.warn(
        { prefix },
        'Rate limiter falling back to in-memory store in production (REDIS_URL not set)',
      );
    }
    return undefined;
  }
  return new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: (...args: string[]) => (client as any).call(...args),
    prefix: `voyager-rl:${prefix}:`,
  }) as unknown as Store;
}

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldBypass,
  store: makeStore('global'),
});

/**
 * Per-user limit for the chat/agent endpoint — the most expensive
 * endpoint (triggers multiple Claude API calls + SerpApi calls per
 * request). Keyed by authenticated user ID, not IP.
 */
export const chatRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? 'anonymous',
  message: {
    error: 'RATE_LIMITED',
    message: 'Please wait before sending another message.',
  },
  skip: shouldBypass,
  store: makeStore('chat'),
});

/** Stricter limit for auth routes to resist credential stuffing. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldBypass,
  store: makeStore('auth'),
});
