import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const TEST_ORIGIN = 'http://localhost:5173';

describe('CORS Integration', () => {
  let server: Server;
  let app: (typeof import('app/app.js'))['app'];

  beforeAll(async () => {
    vi.resetModules();
    process.env.CORS_ORIGIN = TEST_ORIGIN;
    const mod = await import('app/app.js');
    app = mod.app;
    server = app.listen(0);
  });

  afterAll(() => {
    server?.close();
  });

  it('includes Access-Control-Allow-Origin for allowed origin', async () => {
    const res = await request(server).get('/health').set('Origin', TEST_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not include CORS headers for disallowed origin', async () => {
    const res = await request(server)
      .get('/health')
      .set('Origin', 'http://evil.com');

    const corsHeader = res.headers['access-control-allow-origin'];
    expect(corsHeader).not.toBe('http://evil.com');
  });

  it('handles preflight OPTIONS request', async () => {
    const res = await request(server)
      .options('/auth/login')
      .set('Origin', TEST_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, X-Requested-With');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(res.headers['access-control-allow-headers']).toMatch(
      /X-Requested-With/i,
    );
  });
});
