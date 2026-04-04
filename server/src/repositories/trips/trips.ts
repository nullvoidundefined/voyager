import { query, withTransaction } from 'app/db/pool/pool.js';
import type {
  CreateTripInput,
  Trip,
  TripCarRental,
  TripExperience,
  TripFlight,
  TripHotel,
  TripWithDetails,
} from 'app/schemas/trips.js';

export async function createTrip(
  userId: string,
  input: CreateTripInput,
): Promise<Trip> {
  const result = await query<Trip>(
    `INSERT INTO trips (user_id, destination, origin, departure_date, return_date,
       budget_total, budget_currency, travelers, preferences)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      input.destination,
      input.origin ?? null,
      input.departure_date ?? null,
      input.return_date ?? null,
      input.budget_total ?? null,
      input.budget_currency,
      input.travelers,
      JSON.stringify(input.preferences),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}

export async function listTrips(userId: string): Promise<Trip[]> {
  const result = await query<Trip>(
    `SELECT * FROM trips WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getTripWithDetails(
  tripId: string,
  userId: string,
): Promise<TripWithDetails | null> {
  const tripResult = await query<Trip>(
    `SELECT * FROM trips WHERE id = $1 AND user_id = $2`,
    [tripId, userId],
  );
  const trip = tripResult.rows[0];
  if (!trip) return null;

  const [flightsResult, hotelsResult, carRentalsResult, experiencesResult] =
    await Promise.all([
      query<TripFlight>(
        `SELECT * FROM trip_flights WHERE trip_id = $1 ORDER BY created_at`,
        [tripId],
      ),
      query<TripHotel>(
        `SELECT * FROM trip_hotels WHERE trip_id = $1 ORDER BY created_at`,
        [tripId],
      ),
      query<TripCarRental>(
        `SELECT * FROM trip_car_rentals WHERE trip_id = $1 ORDER BY created_at`,
        [tripId],
      ),
      query<TripExperience>(
        `SELECT * FROM trip_experiences WHERE trip_id = $1 ORDER BY created_at`,
        [tripId],
      ),
    ]);

  return {
    ...trip,
    flights: flightsResult.rows,
    hotels: hotelsResult.rows,
    car_rentals: carRentalsResult.rows,
    experiences: experiencesResult.rows,
  };
}

export interface UpdateTripInput {
  destination?: string;
  origin?: string;
  departure_date?: string;
  return_date?: string;
  budget_total?: number;
  travelers?: number;
  transport_mode?: 'flying' | 'driving';
  trip_type?: 'round_trip' | 'one_way';
  status?: 'planning' | 'saved' | 'archived';
}

export async function updateTrip(
  tripId: string,
  userId: string,
  input: UpdateTripInput,
): Promise<Trip | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) return null;

  values.push(tripId, userId);
  const result = await query<Trip>(
    `UPDATE trips SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

/** Generic helper for inserting a trip selection row with `selected = true`. */
async function insertTripSelection(
  table: string,
  tripId: string,
  columns: string[],
  input: Record<string, unknown>,
): Promise<void> {
  const allCols = ['trip_id', ...columns, 'selected'];
  const values = [tripId, ...columns.map((c) => input[c] ?? null), true];
  const placeholders = allCols.map((_, i) => `$${i + 1}`).join(', ');
  await query(
    `INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}

export async function insertTripFlight(
  tripId: string,
  input: Record<string, unknown>,
): Promise<void> {
  await insertTripSelection(
    'trip_flights',
    tripId,
    [
      'airline',
      'flight_number',
      'origin',
      'destination',
      'departure_time',
      'arrival_time',
      'price',
      'currency',
    ],
    input,
  );
}

export async function insertTripHotel(
  tripId: string,
  input: Record<string, unknown>,
): Promise<void> {
  await insertTripSelection(
    'trip_hotels',
    tripId,
    [
      'name',
      'city',
      'star_rating',
      'price_per_night',
      'total_price',
      'currency',
      'check_in',
      'check_out',
    ],
    input,
  );
}

export async function insertTripCarRental(
  tripId: string,
  input: Record<string, unknown>,
): Promise<void> {
  await insertTripSelection(
    'trip_car_rentals',
    tripId,
    [
      'provider',
      'car_name',
      'car_type',
      'price_per_day',
      'total_price',
      'currency',
    ],
    input,
  );
}

export async function insertTripExperience(
  tripId: string,
  input: Record<string, unknown>,
): Promise<void> {
  await insertTripSelection(
    'trip_experiences',
    tripId,
    ['name', 'category', 'estimated_cost', 'rating'],
    input,
  );
}

export async function clearSelectionsForTrip(tripId: string): Promise<void> {
  await withTransaction(async (client) => {
    await query(
      'DELETE FROM trip_flights WHERE trip_id = $1',
      [tripId],
      client,
    );
    await query('DELETE FROM trip_hotels WHERE trip_id = $1', [tripId], client);
    await query(
      'DELETE FROM trip_car_rentals WHERE trip_id = $1',
      [tripId],
      client,
    );
    await query(
      'DELETE FROM trip_experiences WHERE trip_id = $1',
      [tripId],
      client,
    );
  });
}

export async function deleteTrip(
  tripId: string,
  userId: string,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id`,
    [tripId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
