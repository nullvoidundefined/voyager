import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as pool from 'app/database/pool.js';
import * as shareHandlers from 'app/handlers/trips/share.js';
import { errorHandler } from 'app/middleware/errorHandler.js';
import * as tripsRepo from 'app/repositories/trips/trips.js';
import { uuid } from 'app/test-fixtures/uuids.js';

vi.mock('app/database/pool.js');
vi.mock('app/repositories/trips/trips.js');

const userId = uuid(0);
const tripId = uuid(1);
const shareId = uuid(2);

const mockTrip = {
  id: tripId,
  user_id: userId,
  destination: 'Tokyo',
  flights: [],
  hotels: [],
  car_rentals: [],
  experiences: [],
};

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
  app.post('/trips/:id/share', shareHandlers.createShareHandler);
  app.get('/shared/:shareId', shareHandlers.getSharedTripHandler);
  app.use(errorHandler);
  return app;
}

describe('POST /trips/:id/share', () => {
  afterEach(() => vi.clearAllMocks());

  it('creates a share link when user owns the trip', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: shareId }],
      rowCount: 1,
    } as never);

    const app = createApp();
    const res = await request(app).post(`/trips/${tripId}/share`);
    expect(res.status).toBe(201);
    expect(res.body.share_id).toBe(shareId);
    expect(res.body.share_url).toContain('/shared/');
    expect(res.body.share_url).toContain(shareId);
  });

  it('returns 403 when the user does not own the trip', async () => {
    // getTripWithDetails returns null when trip does not belong to this user
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app).post(`/trips/${uuid(99)}/share`);
    expect(res.status).toBe(403);
  });
});

describe('GET /shared/:shareId', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns trip data without auth', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ trip_id: tripId, created_by: userId }],
      rowCount: 1,
    } as never);
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );

    const app = createApp();
    const res = await request(app).get(`/shared/${shareId}`);
    expect(res.status).toBe(200);
    expect(res.body.trip).toBeDefined();
  });

  it('returns 404 for unknown share id', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as never);

    const app = createApp();
    const res = await request(app).get(`/shared/${uuid(99)}`);
    expect(res.status).toBe(404);
  });
});
