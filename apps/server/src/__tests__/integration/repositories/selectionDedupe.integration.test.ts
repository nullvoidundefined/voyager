import { describe, expect, it } from 'vitest';

import { seedTrip, seedUser } from 'app/__tests__/integration/helpers/seed.js';
import { pool } from 'app/database/pool.js';
import {
  getActualCostsForTrip,
  insertTripFlight,
} from 'app/repositories/trips/trips.js';

const FLIGHT = {
  airline: 'Iberia',
  flight_number: 'IB3156',
  origin: 'JFK',
  destination: 'MAD',
  departure_time: '2026-07-01T10:00:00Z',
  arrival_time: '2026-07-01T22:00:00Z',
  price: 293,
  currency: 'USD',
  booking_url: 'https://book.example/ib3156',
};

describe('selection dedupe integration', () => {
  it('does not insert a duplicate row when the same flight is selected twice', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);

    await insertTripFlight(trip.id, FLIGHT);
    await insertTripFlight(trip.id, FLIGHT);

    const rows = await pool.query(
      'SELECT COUNT(*)::int AS count FROM trip_flights WHERE trip_id = $1',
      [trip.id],
    );
    expect(rows.rows[0].count).toBe(1);
  });

  it('does not double-count a re-selected flight in the trip budget', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);

    await insertTripFlight(trip.id, FLIGHT);
    await insertTripFlight(trip.id, FLIGHT);

    const costs = await getActualCostsForTrip(trip.id);
    expect(costs.flight_cost).toBe(293);
  });
});
