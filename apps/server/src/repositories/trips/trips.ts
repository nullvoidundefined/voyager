/**
 * Core trip data access: creates, reads, and updates trips and their nested
 * booking records (flights, hotels, car rentals) within transactions. Central
 * repository that keeps a trip and its bookings consistent below the handlers.
 */
import { query, withTransaction } from 'app/database/pool.js';
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
    car_rentals: carRentalsResult.rows,
    experiences: experiencesResult.rows,
    flights: flightsResult.rows,
    hotels: hotelsResult.rows,
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
  flexible_dates?: boolean;
  status?: 'planning' | 'saved' | 'archived';
}

const UPDATE_TRIP_ALLOWED_COLUMNS: ReadonlySet<string> = new Set([
  'destination',
  'origin',
  'departure_date',
  'return_date',
  'budget_total',
  'travelers',
  'transport_mode',
  'trip_type',
  'flexible_dates',
  'status',
]);

export async function updateTrip(
  tripId: string,
  userId: string,
  input: UpdateTripInput,
): Promise<Trip | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && UPDATE_TRIP_ALLOWED_COLUMNS.has(key)) {
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

// Matches "YYYY-MM-DD HH:MM" / "YYYY-MM-DDTHH:MM" with optional seconds,
// sub-seconds, and zone suffix; captures the date and the HH:MM.
const DATE_TIME_SEGMENT_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Derives a stable per-trip dedupe key for a selection by joining canonicalized
 * natural-key columns. Two writers persist the same selection with different
 * surface forms (the deterministic tile-click POST and the agent's select_*
 * paraphrase; see the 2026-07-06 duplicate-flight incident), so the key uses
 * only fields both writers state identically, lowercased, with timestamps
 * normalized to YYYY-MM-DDTHH:MM. booking_url is deliberately NOT used: it is
 * present on only some writers and would split the key.
 */
export function buildSelectionKey(
  input: Record<string, unknown>,
  keyColumns: string[],
): string {
  return keyColumns
    .map((column) => canonicalizeKeySegment(input[column]))
    .join('|');
}

function canonicalizeKeySegment(value: unknown): string {
  const trimmed = String(value ?? '').trim();
  const dateTimeMatch = DATE_TIME_SEGMENT_PATTERN.exec(trimmed);
  if (dateTimeMatch) {
    return `${dateTimeMatch[1]}T${dateTimeMatch[2]}`;
  }
  return trimmed.toLowerCase();
}

/**
 * Generic helper for upserting a trip selection row with `selected = true`.
 * Dedupes on (trip_id, selection_key): a retried or re-emitted selection of the
 * same item refreshes the existing row instead of inserting a duplicate, which
 * would otherwise double-count in getActualCostsForTrip.
 */
async function insertTripSelection(
  table: string,
  tripId: string,
  columns: string[],
  keyColumns: string[],
  input: Record<string, unknown>,
  numericColumns: ReadonlySet<string> = new Set(),
): Promise<void> {
  const selectionKey = buildSelectionKey(input, keyColumns);
  const allCols = ['trip_id', ...columns, 'selected', 'selection_key'];
  const values = [
    tripId,
    ...columns.map((column) => {
      const value = input[column] ?? null;
      if (value !== null && numericColumns.has(column)) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return value;
    }),
    true,
    selectionKey,
  ];
  const placeholders = allCols.map((_, i) => `$${i + 1}`).join(', ');
  const updates = columns
    .map((column) => `${column} = EXCLUDED.${column}`)
    .concat('selected = EXCLUDED.selected')
    .join(', ');
  await query(
    `INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders})
     ON CONFLICT (trip_id, selection_key) DO UPDATE SET ${updates}`,
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
      'booking_url',
    ],
    // Route + departure instant only: airline and flight_number are excluded
    // because the agent paraphrases them ("American + Etihad", "AA 2614 / EY
    // 12") while the tile path sends the canonical strings, splitting the key.
    ['origin', 'destination', 'departure_time'],
    input,
    new Set(['price']),
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
      'booking_url',
    ],
    ['name', 'check_in', 'check_out'],
    input,
    new Set(['star_rating', 'price_per_night', 'total_price']),
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
      'booking_url',
    ],
    ['provider', 'car_name', 'car_type'],
    input,
    new Set(['price_per_day', 'total_price']),
  );
}

export async function insertTripExperience(
  tripId: string,
  input: Record<string, unknown>,
): Promise<void> {
  await insertTripSelection(
    'trip_experiences',
    tripId,
    ['name', 'category', 'estimated_cost', 'rating', 'booking_url'],
    ['name', 'category'],
    input,
    new Set(['estimated_cost', 'rating']),
  );
}

export interface ActualTripCosts {
  total_budget: number;
  flight_cost: number;
  hotel_total_cost: number;
  car_rental_cost: number;
  experience_costs: number[];
}

// P1-03: Single query that pulls the trip budget plus actually-selected
// flight/hotel/car-rental/experience prices from the DB. The agent has
// been observed hallucinating cheaper numbers when it called
// calculate_remaining_budget; passing this output into
// calculateRemainingBudget instead of the agent input keeps the budget
// panel honest. P2-04 added car_rental_cost so car rentals are never
// invisible in budget calculations.
export async function getActualCostsForTrip(
  tripId: string,
): Promise<ActualTripCosts> {
  const result = await query<{
    budget_total: string | null;
    flight_cost: string | null;
    hotel_total_cost: string | null;
    car_rental_cost: string | null;
    experience_costs: string[] | string | null;
  }>(
    `SELECT
       t.budget_total,
       (SELECT COALESCE(SUM(price), 0) FROM trip_flights WHERE trip_id = $1 AND selected = true) AS flight_cost,
       (SELECT COALESCE(SUM(total_price), 0) FROM trip_hotels WHERE trip_id = $1 AND selected = true) AS hotel_total_cost,
       (SELECT COALESCE(SUM(total_price), 0) FROM trip_car_rentals WHERE trip_id = $1 AND selected = true) AS car_rental_cost,
       (SELECT COALESCE(ARRAY_AGG(estimated_cost), '{}') FROM trip_experiences WHERE trip_id = $1 AND selected = true) AS experience_costs
     FROM trips t
     WHERE t.id = $1`,
    [tripId],
  );

  const row = result.rows[0];
  return {
    car_rental_cost: Number(row?.car_rental_cost ?? 0),
    experience_costs: listExperienceCosts(row?.experience_costs)
      .map((cost) => Number(cost))
      .filter((cost) => !Number.isNaN(cost)),
    flight_cost: Number(row?.flight_cost ?? 0),
    hotel_total_cost: Number(row?.hotel_total_cost ?? 0),
    total_budget: Number(row?.budget_total ?? 0),
  };
}

// pg returns ARRAY_AGG as a JS array when the driver parses it, or as a
// Postgres literal string like '{50,75}' otherwise.
function listExperienceCosts(
  rawCosts: string[] | string | null | undefined,
): string[] {
  if (Array.isArray(rawCosts)) {
    return rawCosts;
  }
  if (typeof rawCosts === 'string' && rawCosts.startsWith('{')) {
    return rawCosts.slice(1, -1).split(',').filter(Boolean);
  }
  return [];
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
