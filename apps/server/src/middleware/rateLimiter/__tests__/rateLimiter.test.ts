import {
  authRateLimiter,
  chatRateLimiter,
  rateLimiter,
} from 'app/middleware/rateLimiter/rateLimiter.js';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

function buildApp(
  limiter: ReturnType<typeof import('express-rate-limit').default>,
) {
  const app = express();
  app.use(limiter);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('sets standard rate-limit headers', async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get('/test');
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  it('does not set legacy X-RateLimit headers', async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get('/test');
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });
});

describe('chatRateLimiter', () => {
  it('keys by user ID, not IP', async () => {
    const app = express();
    // Simulate authenticated user
    app.use((req, _res, next) => {
      req.user = { id: 'user-1' } as Express.Request['user'];
      next();
    });
    app.use(chatRateLimiter);
    app.post('/chat', (_req, res) => res.json({ ok: true }));

    const res = await request(app).post('/chat');
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding chat limit', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: 'chat-flood-user' } as Express.Request['user'];
      next();
    });
    app.use(chatRateLimiter);
    app.post('/chat', (_req, res) => res.json({ ok: true }));

    // Chat limit is 10 per 5 minutes
    for (let i = 0; i < 10; i++) {
      await request(app).post('/chat');
    }

    const blocked = await request(app).post('/chat');
    expect(blocked.status).toBe(429);
  });

  it('returns a clear message on 429', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: 'msg-check-user' } as Express.Request['user'];
      next();
    });
    app.use(chatRateLimiter);
    app.post('/chat', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 10; i++) {
      await request(app).post('/chat');
    }

    const blocked = await request(app).post('/chat');
    expect(blocked.body.message).toContain('wait');
  });
});

describe('authRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(authRateLimiter);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding the auth limit', async () => {
    const app = buildApp(authRateLimiter);

    for (let i = 0; i < 10; i++) {
      await request(app).get('/test');
    }

    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
  });
});

describe('E2E_BYPASS_RATE_LIMITS', () => {
  // Note: the limiter's `skip` callback is evaluated per request,
  // so toggling the env var between requests changes behavior
  // without re-importing the module. The boot test uses a
  // separate non-listening Redis URL; this suite stays in-memory.
  const ORIGINAL = process.env.E2E_BYPASS_RATE_LIMITS;

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.E2E_BYPASS_RATE_LIMITS;
    } else {
      process.env.E2E_BYPASS_RATE_LIMITS = ORIGINAL;
    }
  });

  it('skips the auth limiter entirely when set to "1"', async () => {
    process.env.E2E_BYPASS_RATE_LIMITS = '1';
    const app = buildApp(authRateLimiter);

    // Send well past the 10/15-min limit. None should 429.
    for (let i = 0; i < 50; i++) {
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
    }
  });

  it('does not skip when unset', async () => {
    delete process.env.E2E_BYPASS_RATE_LIMITS;
    const app = buildApp(authRateLimiter);

    for (let i = 0; i < 10; i++) {
      await request(app).get('/test');
    }
    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
  });
});
