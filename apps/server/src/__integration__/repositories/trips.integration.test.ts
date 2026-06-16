import { pool } from 'app/database/pool/pool.js';
import {
  clearSelectionsForTrip,
  createTrip,
  deleteTrip,
  getActualCostsForTrip,
  getTripWithDetails,
  insertTripCarRental,
  insertTripExperience,
  insertTripFlight,
  insertTripHotel,
  listTrips,
  updateTrip,
} from 'app/repositories/trips/trips.js';
import { describe, expect, it } from 'vitest';

import { seedTrip, seedUser } from '../helpers/seed.js';

describe('trips repository integration', () => {
  describe('createTrip', () => {
    it('inserts a trip row and returns it', async () => {
      const user = await seedUser();

      const trip = await createTrip(user.id, {
        destination: 'Tokyo',
        origin: 'Los Angeles',
        departure_date: '2026-09-01',
        return_date: '2026-09-14',
        budget_total: 8000,
        budget_currency: 'USD',
        travelers: 2,
        preferences: {},
      });

      expect(trip.id).toBeDefined();
      expect(trip.user_id).toBe(user.id);
      expect(trip.destination).toBe('Tokyo');
      expect(trip.origin).toBe('Los Angeles');
      expect(trip.budget_total).toBe(8000);
      expect(trip.travelers).toBe(2);
      expect(trip.status).toBe('planning');

      const dbResult = await pool.query('SELECT * FROM trips WHERE id = $1', [
        trip.id,
      ]);
      expect(dbResult.rows).toHaveLength(1);
    });

    it('accepts optional fields as null', async () => {
      const user = await seedUser();
      const trip = await createTrip(user.id, {
        destination: 'Bali',
        budget_currency: 'USD',
        travelers: 1,
        preferences: {},
      });

      expect(trip.origin).toBeNull();
      expect(trip.departure_date).toBeNull();
      expect(trip.return_date).toBeNull();
      expect(trip.budget_total).toBeNull();
    });
  });

  describe('listTrips', () => {
    it('returns trips for the given user ordered by updated_at desc', async () => {
      const user = await seedUser();

      await seedTrip(user.id, { destination: 'Paris' });
      await seedTrip(user.id, { destination: 'Rome' });

      const trips = await listTrips(user.id);
      expect(trips.length).toBeGreaterThanOrEqual(2);
      trips.forEach((t) => expect(t.user_id).toBe(user.id));
    });

    it('returns empty array for a user with no trips', async () => {
      const user = await seedUser();
      const trips = await listTrips(user.id);
      expect(trips).toHaveLength(0);
    });

    it('does not return trips from other users', async () => {
      const user1 = await seedUser();
      const user2 = await seedUser();
      await seedTrip(user1.id, { destination: 'Berlin' });

      const trips = await listTrips(user2.id);
      expect(trips).toHaveLength(0);
    });
  });

  describe('getTripWithDetails', () => {
    it('returns null for an unknown trip id', async () => {
      const user = await seedUser();
      const result = await getTripWithDetails(
        '00000000-0000-0000-0000-000000000000',
        user.id,
      );
      expect(result).toBeNull();
    });

    it('returns null when trip belongs to another user', async () => {
      const owner = await seedUser();
      const other = await seedUser();
      const trip = await seedTrip(owner.id);

      const result = await getTripWithDetails(trip.id, other.id);
      expect(result).toBeNull();
    });

    it('returns trip with empty selection arrays when no selections exist', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      const result = await getTripWithDetails(trip.id, user.id);
      expect(result).not.toBeNull();
      expect(result!.flights).toHaveLength(0);
      expect(result!.hotels).toHaveLength(0);
      expect(result!.car_rentals).toHaveLength(0);
      expect(result!.experiences).toHaveLength(0);
    });

    it('returns trip with populated selections', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      await insertTripFlight(trip.id, {
        origin: 'JFK',
        destination: 'CDG',
        airline: 'Air France',
        flight_number: 'AF007',
        price: 800,
        currency: 'USD',
      });
      await insertTripHotel(trip.id, {
        name: 'Le Grand Hotel',
        city: 'Paris',
        price_per_night: 200,
        total_price: 2000,
        currency: 'USD',
      });

      const result = await getTripWithDetails(trip.id, user.id);
      expect(result!.flights).toHaveLength(1);
      expect(result!.hotels).toHaveLength(1);
      expect(result!.flights[0]!.airline).toBe('Air France');
      expect(result!.hotels[0]!.name).toBe('Le Grand Hotel');
    });
  });

  describe('updateTrip', () => {
    it('updates allowed fields and returns the updated trip', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id, { destination: 'Paris' });

      const updated = await updateTrip(trip.id, user.id, {
        destination: 'Lyon',
        travelers: 3,
      });

      expect(updated).not.toBeNull();
      expect(updated!.destination).toBe('Lyon');
      expect(updated!.travelers).toBe(3);

      const dbResult = await pool.query('SELECT * FROM trips WHERE id = $1', [
        trip.id,
      ]);
      expect(dbResult.rows[0].destination).toBe('Lyon');
    });

    it('returns null when input has no valid fields', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      const result = await updateTrip(trip.id, user.id, {});
      expect(result).toBeNull();
    });

    it('returns null when trip belongs to another user', async () => {
      const owner = await seedUser();
      const other = await seedUser();
      const trip = await seedTrip(owner.id);

      const result = await updateTrip(trip.id, other.id, {
        destination: 'Hack',
      });
      expect(result).toBeNull();
    });

    it('silently ignores unrecognized keys (allowlist enforcement)', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id, { destination: 'Paris' });

      // Pass an unknown key alongside a valid one
      const input = {
        destination: 'Nice',
        evil_column: 'DROP TABLE',
      } as Parameters<typeof updateTrip>[2];
      const result = await updateTrip(trip.id, user.id, input);

      expect(result).not.toBeNull();
      expect(result!.destination).toBe('Nice');
    });
  });

  describe('deleteTrip', () => {
    it('deletes the trip and returns true', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      const deleted = await deleteTrip(trip.id, user.id);
      expect(deleted).toBe(true);

      const dbResult = await pool.query('SELECT * FROM trips WHERE id = $1', [
        trip.id,
      ]);
      expect(dbResult.rows).toHaveLength(0);
    });

    it('returns false for unknown trip', async () => {
      const user = await seedUser();
      const result = await deleteTrip(
        '00000000-0000-0000-0000-000000000000',
        user.id,
      );
      expect(result).toBe(false);
    });

    it('returns false when trip belongs to another user', async () => {
      const owner = await seedUser();
      const other = await seedUser();
      const trip = await seedTrip(owner.id);

      const result = await deleteTrip(trip.id, other.id);
      expect(result).toBe(false);

      // Trip should still exist
      const dbResult = await pool.query('SELECT * FROM trips WHERE id = $1', [
        trip.id,
      ]);
      expect(dbResult.rows).toHaveLength(1);
    });
  });

  describe('insertTripFlight', () => {
    it('inserts a flight selection row with selected=true', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      await insertTripFlight(trip.id, {
        origin: 'LHR',
        destination: 'SYD',
        airline: 'Qantas',
        flight_number: 'QF001',
        price: 1200,
        currency: 'AUD',
      });

      const dbResult = await pool.query(
        'SELECT * FROM trip_flights WHERE trip_id = $1',
        [trip.id],
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].airline).toBe('Qantas');
      expect(dbResult.rows[0].selected).toBe(true);
    });
  });

  describe('insertTripHotel', () => {
    it('inserts a hotel selection row with selected=true', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      await insertTripHotel(trip.id, {
        name: 'Sydney Harbour Hotel',
        city: 'Sydney',
        star_rating: 5,
        price_per_night: 450,
        total_price: 4500,
        currency: 'AUD',
        check_in: '2026-09-01',
        check_out: '2026-09-11',
      });

      const dbResult = await pool.query(
        'SELECT * FROM trip_hotels WHERE trip_id = $1',
        [trip.id],
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].name).toBe('Sydney Harbour Hotel');
      expect(dbResult.rows[0].selected).toBe(true);
    });
  });

  describe('insertTripCarRental', () => {
    it('inserts a car rental selection row with selected=true', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      await insertTripCarRental(trip.id, {
        provider: 'Hertz',
        car_name: 'Toyota Camry',
        car_type: 'sedan',
        price_per_day: 75,
        total_price: 750,
        currency: 'USD',
      });

      const dbResult = await pool.query(
        'SELECT * FROM trip_car_rentals WHERE trip_id = $1',
        [trip.id],
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].provider).toBe('Hertz');
      expect(dbResult.rows[0].selected).toBe(true);
    });
  });

  describe('insertTripExperience', () => {
    it('inserts an experience selection row with selected=true', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      await insertTripExperience(trip.id, {
        name: 'Eiffel Tower Tour',
        category: 'landmark',
        estimated_cost: 25,
        rating: 4.8,
      });

      const dbResult = await pool.query(
        'SELECT * FROM trip_experiences WHERE trip_id = $1',
        [trip.id],
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].name).toBe('Eiffel Tower Tour');
      expect(dbResult.rows[0].selected).toBe(true);
    });
  });

  describe('clearSelectionsForTrip', () => {
    it('removes all selection rows across all tables for the trip', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      await insertTripFlight(trip.id, {
        origin: 'JFK',
        destination: 'CDG',
        currency: 'USD',
      });
      await insertTripHotel(trip.id, { name: 'Hotel Test', currency: 'USD' });
      await insertTripCarRental(trip.id, {
        provider: 'Avis',
        car_name: 'Ford Focus',
        car_type: 'compact',
        price_per_day: 50,
        total_price: 300,
        currency: 'USD',
      });
      await insertTripExperience(trip.id, {
        name: 'Museum Visit',
        category: 'culture',
      });

      await clearSelectionsForTrip(trip.id);

      const [flights, hotels, rentals, experiences] = await Promise.all([
        pool.query('SELECT * FROM trip_flights WHERE trip_id = $1', [trip.id]),
        pool.query('SELECT * FROM trip_hotels WHERE trip_id = $1', [trip.id]),
        pool.query('SELECT * FROM trip_car_rentals WHERE trip_id = $1', [
          trip.id,
        ]),
        pool.query('SELECT * FROM trip_experiences WHERE trip_id = $1', [
          trip.id,
        ]),
      ]);

      expect(flights.rows).toHaveLength(0);
      expect(hotels.rows).toHaveLength(0);
      expect(rentals.rows).toHaveLength(0);
      expect(experiences.rows).toHaveLength(0);
    });

    it('is a no-op for a trip with no selections', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      // Should not throw
      await expect(clearSelectionsForTrip(trip.id)).resolves.toBeUndefined();
    });
  });

  describe('getActualCostsForTrip', () => {
    it('sums actually-selected prices from the DB, ignoring any agent input', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id, { budget_total: 3000 });

      await insertTripFlight(trip.id, {
        origin: 'JFK',
        destination: 'CDG',
        price: 900,
        currency: 'USD',
      });
      await insertTripHotel(trip.id, {
        name: 'Hotel Real',
        total_price: 1200,
        currency: 'USD',
      });
      await insertTripExperience(trip.id, {
        name: 'Louvre',
        category: 'culture',
        estimated_cost: 50,
      });
      await insertTripExperience(trip.id, {
        name: 'Eiffel',
        category: 'sightseeing',
        estimated_cost: 75,
      });

      const costs = await getActualCostsForTrip(trip.id);

      expect(costs.total_budget).toBe(3000);
      expect(costs.flight_cost).toBe(900);
      expect(costs.hotel_total_cost).toBe(1200);
      expect(costs.car_rental_cost).toBe(0);
      expect(costs.experience_costs.sort()).toEqual([50, 75]);
    });

    it('includes selected car_rental_cost in the totals (P2-04)', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id, { budget_total: 3000 });

      await insertTripCarRental(trip.id, {
        provider: 'Avis',
        car_name: 'Ford Focus',
        car_type: 'compact',
        price_per_day: 50,
        total_price: 350,
        currency: 'USD',
      });

      const costs = await getActualCostsForTrip(trip.id);

      expect(costs.car_rental_cost).toBe(350);
    });

    it('returns zeros (not the trip budget) when nothing is selected', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id, { budget_total: 2000 });

      const costs = await getActualCostsForTrip(trip.id);

      expect(costs.total_budget).toBe(2000);
      expect(costs.flight_cost).toBe(0);
      expect(costs.hotel_total_cost).toBe(0);
      expect(costs.car_rental_cost).toBe(0);
      expect(costs.experience_costs).toEqual([]);
    });
  });
});
