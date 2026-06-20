import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uuid } from 'app/__fixtures__/uuids.js';
import * as scheduleHandlers from 'app/handlers/trips/schedule.js';
import { errorHandler } from 'app/middleware/errorHandler.js';
import * as scheduleRepo from 'app/repositories/trips/scheduleRepository.js';
import * as tripsRepo from 'app/repositories/trips/trips.js';

vi.mock('app/repositories/trips/scheduleRepository.js');
vi.mock('app/repositories/trips/trips.js');

const userId = uuid(0);
const tripId = uuid(1);

const mockTrip = { id: tripId, user_id: userId };

const mockDay = {
  id: uuid(2),
  trip_id: tripId,
  day_date: '2026-08-01',
  day_number: 1,
  created_at: '2026-01-01T00:00:00Z',
  items: [],
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
  app.get('/trips/:id/schedule', scheduleHandlers.getScheduleHandler);
  app.use(errorHandler);
  return app;
}

describe('GET /trips/:id/schedule', () => {
  beforeEach(() => {
    vi.mocked(scheduleRepo.getScheduleForTrip).mockResolvedValue([mockDay]);
  });
  afterEach(() => vi.clearAllMocks());

  it('returns 200 with a days array', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );

    const app = createApp();
    const res = await request(app).get(`/trips/${tripId}/schedule`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(res.body.days).toHaveLength(1);
    expect(vi.mocked(scheduleRepo.getScheduleForTrip)).toHaveBeenCalledWith(
      tripId,
    );
  });

  it('returns 403 when the user does not own the trip', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app).get(`/trips/${uuid()}/schedule`);
    expect(res.status).toBe(403);
  });
});
