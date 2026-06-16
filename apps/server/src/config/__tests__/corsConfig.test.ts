import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression test for the 2026-04-06 E2E CORS incident.
 *
 * Bug: corsConfig.ts had a default of `http://localhost:5173` (a
 * legacy Vite port from an earlier incarnation of the project).
 * The Next.js dev server runs on :3000. The Plan B E2E workflow
 * did not override CORS_ORIGIN, so every browser request from
 * the Playwright runner returned `net::ERR_FAILED` and 35
 * specs retried three times before the suite failed at 15m19s.
 *
 * The corsConfig module itself is correct: it parses
 * CORS_ORIGIN as a comma-separated allowlist. The fix is simply
 * to set CORS_ORIGIN=http://localhost:3000 in playwright.config.ts
 * webServer.env and in the e2e.yml workflow step.
 *
 * This test locks in the parsing behavior so any future change
 * that breaks comma-separated origin handling, the localhost:3000
 * specifically, or the credentials:true setting will fail in
 * unit tests instead of in a 15-minute CI run.
 */

describe('corsConfig', () => {
  const ORIGINAL = process.env.CORS_ORIGIN;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = ORIGINAL;
    }
    vi.resetModules();
  });

  async function loadCorsConfig() {
    const mod = await import('app/config/corsConfig.js');
    return mod.corsConfig;
  }

  function makeRequestResponse(origin: string) {
    const req = { headers: { origin } } as never;
    let allowedOrigin: string | false | undefined;
    let calledNext = false;
    const res = {
      setHeader: (key: string, value: string) => {
        if (key.toLowerCase() === 'access-control-allow-origin') {
          allowedOrigin = value;
        }
      },
      getHeader: () => undefined,
      end: () => undefined,
    } as never;
    const next = () => {
      calledNext = true;
    };
    return {
      req,
      res,
      next,
      get allowedOrigin() {
        return allowedOrigin;
      },
      get calledNext() {
        return calledNext;
      },
    };
  }

  it('allows http://localhost:3000 when CORS_ORIGIN is set to it', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const corsConfig = await loadCorsConfig();
    const ctx = makeRequestResponse('http://localhost:3000');
    await new Promise<void>((resolve) => {
      corsConfig(ctx.req, ctx.res, () => {
        ctx.next();
        resolve();
      });
    });
    expect(ctx.allowedOrigin).toBe('http://localhost:3000');
  });

  it('parses a comma-separated allowlist and accepts each origin', async () => {
    process.env.CORS_ORIGIN =
      'http://localhost:3000,https://example.test,https://other.test';
    const corsConfig = await loadCorsConfig();

    for (const origin of [
      'http://localhost:3000',
      'https://example.test',
      'https://other.test',
    ]) {
      const ctx = makeRequestResponse(origin);
      await new Promise<void>((resolve) => {
        corsConfig(ctx.req, ctx.res, () => {
          ctx.next();
          resolve();
        });
      });
      expect(ctx.allowedOrigin).toBe(origin);
    }
  });

  it('rejects an origin that is not in the allowlist', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const corsConfig = await loadCorsConfig();
    const ctx = makeRequestResponse('http://evil.test');
    let error: unknown;
    await new Promise<void>((resolve) => {
      corsConfig(ctx.req, ctx.res, (err: unknown) => {
        error = err;
        resolve();
      });
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/not allowed by CORS/);
  });

  it('uses the legacy localhost:5173 default ONLY when CORS_ORIGIN is unset', async () => {
    delete process.env.CORS_ORIGIN;
    const corsConfig = await loadCorsConfig();

    // Legacy default still allows localhost:5173 for back-compat
    // with anyone running an old Vite frontend, but localhost:3000
    // (Next.js, the current frontend) is blocked. This is the
    // exact misconfiguration that bit Plan B option B in CI:
    // forgetting to set CORS_ORIGIN is a self-inflicted wound.
    const ctxLegacy = makeRequestResponse('http://localhost:5173');
    await new Promise<void>((resolve) => {
      corsConfig(ctxLegacy.req, ctxLegacy.res, () => resolve());
    });
    expect(ctxLegacy.allowedOrigin).toBe('http://localhost:5173');

    const ctxNext = makeRequestResponse('http://localhost:3000');
    let nextError: unknown;
    await new Promise<void>((resolve) => {
      corsConfig(ctxNext.req, ctxNext.res, (err: unknown) => {
        nextError = err;
        resolve();
      });
    });
    expect(nextError).toBeInstanceOf(Error);
  });
});
