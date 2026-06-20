import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uuid } from 'app/__fixtures__/uuids.js';
import * as legsHandlers from 'app/handlers/trips/legs.js';
import { errorHandler } from 'app/middleware/errorHandler.js';
import * as legsRepo from 'app/repositories/trips/tripLegsRepository.js';
import * as tripsRepo from 'app/repositories/trips/trips.js';

vi.mock('app/repositories/trips/tripLegsRepository.js');
vi.mock('app/repositories/trips/trips.js');

const userId = uuid(0);
const tripId = uuid(1);
const legId = uuid(2);

const mockTrip = { id: tripId, user_id: userId };

const mockLeg = {
  id: legId,
  trip_id: tripId,
  origin: 'NYC',
  destination: 'LAX',
  depart_date: '2026-08-01',
  leg_order: 1,
  created_at: '2026-01-01T00:00:00Z',
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
  app.get('/trips/:id/legs', legsHandlers.listLegs);
  app.post('/trips/:id/legs', legsHandlers.addLeg);
  app.delete('/trips/:id/legs/:legId', legsHandlers.removeLeg);
  app.put('/trips/:id/legs/reorder', legsHandlers.reorderLegs);
  app.use(errorHandler);
  return app;
}

describe('GET /trips/:id/legs', () => {
  beforeEach(() => {
    vi.mocked(legsRepo.listLegs).mockResolvedValue([mockLeg]);
  });
  afterEach(() => vi.clearAllMocks());

  it('returns legs for a trip', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );

    const app = createApp();
    const res = await request(app).get(`/trips/${tripId}/legs`);
    expect(res.status).toBe(200);
    expect(res.body.legs).toHaveLength(1);
    expect(res.body.legs[0].id).toBe(legId);
    expect(vi.mocked(legsRepo.listLegs)).toHaveBeenCalledWith(tripId);
  });

  it('returns 403 when the user does not own the trip', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app).get(`/trips/${uuid()}/legs`);
    expect(res.status).toBe(403);
  });
});

describe('POST /trips/:id/legs', () => {
  beforeEach(() => {
    vi.mocked(legsRepo.createLeg).mockResolvedValue(mockLeg);
  });
  afterEach(() => vi.clearAllMocks());

  it('creates a leg and returns 201', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );

    const app = createApp();
    const res = await request(app).post(`/trips/${tripId}/legs`).send({
      origin: 'NYC',
      destination: 'LAX',
      depart_date: '2026-08-01',
      leg_order: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.leg.id).toBe(legId);
    expect(vi.mocked(legsRepo.createLeg)).toHaveBeenCalledWith(
      tripId,
      expect.objectContaining({ origin: 'NYC' }),
    );
  });

  it('returns 400 for missing fields', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );

    const app = createApp();
    const res = await request(app)
      .post(`/trips/${tripId}/legs`)
      .send({ origin: 'NYC' });
    expect(res.status).toBe(400);
  });

  it('returns 403 when the user does not own the trip', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app).post(`/trips/${uuid()}/legs`).send({
      origin: 'NYC',
      destination: 'LAX',
      depart_date: '2026-08-01',
      leg_order: 1,
    });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /trips/:id/legs/:legId', () => {
  beforeEach(() => {
    vi.mocked(legsRepo.deleteLeg).mockResolvedValue(undefined);
  });
  afterEach(() => vi.clearAllMocks());

  it('deletes a leg and returns 204', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );

    const app = createApp();
    const res = await request(app).delete(`/trips/${tripId}/legs/${legId}`);
    expect(res.status).toBe(204);
    expect(vi.mocked(legsRepo.deleteLeg)).toHaveBeenCalledWith(legId, tripId);
  });

  it('returns 404 when the leg does not belong to the trip (SEC-01)', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );
    vi.mocked(legsRepo.deleteLeg).mockRejectedValueOnce(
      new Error('Leg not found or does not belong to this trip'),
    );

    const app = createApp();
    const res = await request(app).delete(`/trips/${tripId}/legs/${legId}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when the user does not own the trip', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app).delete(`/trips/${uuid()}/legs/${legId}`);
    expect(res.status).toBe(403);
  });
});

describe('PUT /trips/:id/legs/reorder', () => {
  beforeEach(() => {
    vi.mocked(legsRepo.reorderLegs).mockResolvedValue(undefined);
  });
  afterEach(() => vi.clearAllMocks());

  it('reorders legs and returns 200', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );

    const app = createApp();
    const ids = [uuid(3), uuid(4)];
    const res = await request(app)
      .put(`/trips/${tripId}/legs/reorder`)
      .send({ ordered_leg_ids: ids });
    expect(res.status).toBe(200);
    expect(res.body.reordered).toBe(true);
    expect(vi.mocked(legsRepo.reorderLegs)).toHaveBeenCalledWith(ids, tripId);
  });

  it('returns 404 when any leg does not belong to the trip (SEC-01)', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );
    vi.mocked(legsRepo.reorderLegs).mockRejectedValueOnce(
      new Error('One or more leg ids do not belong to this trip'),
    );

    const app = createApp();
    const res = await request(app)
      .put(`/trips/${tripId}/legs/reorder`)
      .send({ ordered_leg_ids: [uuid(3), uuid(4)] });
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing ordered_leg_ids', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(
      mockTrip as never,
    );

    const app = createApp();
    const res = await request(app)
      .put(`/trips/${tripId}/legs/reorder`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 403 when the user does not own the trip', async () => {
    vi.mocked(tripsRepo.getTripWithDetails).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app)
      .put(`/trips/${uuid()}/legs/reorder`)
      .send({ ordered_leg_ids: [uuid(3), uuid(4)] });
    expect(res.status).toBe(403);
  });
});
