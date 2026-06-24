import express from 'express';
import type { Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findIdempotentResponse = vi.fn();
const saveIdempotentResponse = vi.fn();

vi.mock('app/repositories/idempotency.js', () => ({
  findIdempotentResponse: (...args: unknown[]) =>
    findIdempotentResponse(...args),
  saveIdempotentResponse: (...args: unknown[]) =>
    saveIdempotentResponse(...args),
}));

const { idempotencyGuard } = await import('app/middleware/idempotencyGuard.js');

const USER_ID = 'user-1';
const KEY = 'key-abc';

function buildApp(options: { withUser?: boolean } = {}) {
  const { withUser = true } = options;
  const handlerCalls = { count: 0 };
  const app = express();
  app.use(express.json());
  if (withUser) {
    app.use((req: Request, _res, next) => {
      (req as unknown as { user: { id: string } }).user = { id: USER_ID };
      next();
    });
  }
  app.use(idempotencyGuard);
  app.post('/selections', (_req, res) => {
    handlerCalls.count += 1;
    res.status(201).json({ created: true, n: handlerCalls.count });
  });
  app.post('/fails', (_req, res) => {
    handlerCalls.count += 1;
    res.status(409).json({ error: 'CONFLICT' });
  });
  return { app, handlerCalls };
}

describe('idempotencyGuard', () => {
  beforeEach(() => {
    findIdempotentResponse.mockReset();
    saveIdempotentResponse.mockReset();
    findIdempotentResponse.mockResolvedValue(null);
    saveIdempotentResponse.mockResolvedValue(undefined);
  });

  it('runs the handler when no Idempotency-Key is present', async () => {
    const { app, handlerCalls } = buildApp();
    const res = await request(app).post('/selections').send({});
    expect(res.status).toBe(201);
    expect(handlerCalls.count).toBe(1);
    expect(findIdempotentResponse).not.toHaveBeenCalled();
  });

  it('runs the handler and stores the response on first call with a key', async () => {
    const { app, handlerCalls } = buildApp();
    const res = await request(app)
      .post('/selections')
      .set('Idempotency-Key', KEY)
      .send({});
    expect(res.status).toBe(201);
    expect(handlerCalls.count).toBe(1);
    expect(saveIdempotentResponse).toHaveBeenCalledWith(USER_ID, KEY, 201, {
      created: true,
      n: 1,
    });
  });

  it('replays the stored response without running the handler on retry', async () => {
    findIdempotentResponse.mockResolvedValue({
      responseStatus: 201,
      responseBody: { created: true, n: 1 },
    });
    const { app, handlerCalls } = buildApp();
    const res = await request(app)
      .post('/selections')
      .set('Idempotency-Key', KEY)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: true, n: 1 });
    expect(handlerCalls.count).toBe(0);
    expect(saveIdempotentResponse).not.toHaveBeenCalled();
  });

  it('does not store error responses (status >= 400)', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/fails')
      .set('Idempotency-Key', KEY)
      .send({});
    expect(res.status).toBe(409);
    expect(saveIdempotentResponse).not.toHaveBeenCalled();
  });

  it('passes through unauthenticated requests without touching the store', async () => {
    const { app, handlerCalls } = buildApp({ withUser: false });
    const res = await request(app)
      .post('/selections')
      .set('Idempotency-Key', KEY)
      .send({});
    expect(res.status).toBe(201);
    expect(handlerCalls.count).toBe(1);
    expect(findIdempotentResponse).not.toHaveBeenCalled();
  });
});
