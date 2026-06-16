import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as pool from 'app/database/pool/pool.js';
import * as costsHandlers from 'app/handlers/trips/costs.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import * as tripsRepo from 'app/repositories/trips/trips.js';
import { uuid } from 'app/test-fixtures/uuids.js';

vi.mock('app/database/pool/pool.js');
vi.mock('app/repositories/trips/trips.js');

const userId = uuid(0);
const tripId = uuid(1);

const mockTrip = { id: tripId, user_id: userId };

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: userId,
      email: 'user@example.com',
      first_name: 'Test',
      last_name: 'User',
      created_at: new Date('2025-01-01'),
      updated_at: null,
    };
    next();
  });
  app.get('/trips/:id/costs', costsHandlers.getTripCostsHandler);
  app.use(errorHandler);
  return app;
}

describe('GET /trips/:id/costs', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns 200 with total_tokens and total_cost_usd', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ total_tokens: '12400', total_cost: '0.003100' }],
      rowCount: 1,
    } as never);

    const app = createApp();
    const res = await request(app).get(`/trips/${tripId}/costs`);
    expect(res.status).toBe(200);
    expect(typeof res.body.total_tokens).toBe('number');
    expect(typeof res.body.total_cost_usd).toBe('string');
  });

  it('returns zeros when no cost rows exist', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ total_tokens: '0', total_cost: '0.000000' }],
      rowCount: 1,
    } as never);

    const app = createApp();
    const res = await request(app).get(`/trips/${tripId}/costs`);
    expect(res.status).toBe(200);
    expect(res.body.total_tokens).toBe(0);
    expect(res.body.total_cost_usd).toBe('0.0000');
  });

  it('returns 403 when the user does not own the trip', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app).get(`/trips/${uuid()}/costs`);
    expect(res.status).toBe(403);
  });
});
