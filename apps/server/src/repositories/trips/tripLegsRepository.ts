/**
 * Trip leg data access. Persists and reads the individual legs of a
 * multi-destination trip so each segment's routing can be stored and queried
 * independently of the parent trip record.
 */
import { query } from 'app/database/pool.js';

export interface TripLeg {
  id: string;
  trip_id: string;
  origin: string;
  destination: string;
  depart_date: string;
  leg_order: number;
  created_at: string;
}

export interface CreateLegInput {
  origin: string;
  destination: string;
  depart_date: string;
  leg_order: number;
}

export async function createLeg(
  tripId: string,
  input: CreateLegInput,
): Promise<TripLeg> {
  const result = await query<TripLeg>(
    `INSERT INTO trip_legs (trip_id, origin, destination, depart_date, leg_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      tripId,
      input.origin,
      input.destination,
      input.depart_date,
      input.leg_order,
    ],
  );
  return result.rows[0]!;
}

export async function listLegs(tripId: string): Promise<TripLeg[]> {
  const result = await query<TripLeg>(
    `SELECT * FROM trip_legs WHERE trip_id = $1 ORDER BY leg_order ASC`,
    [tripId],
  );
  return result.rows;
}

export async function deleteLeg(legId: string, tripId: string): Promise<void> {
  // SEC-01: scope to trip_id so a leg cannot be deleted via another trip's
  // route. The handler-layer ownership check (assertTripOwnership) verifies
  // the trip but does not verify the child resource belongs to that trip.
  const result = await query(
    `DELETE FROM trip_legs WHERE id = $1 AND trip_id = $2`,
    [legId, tripId],
  );
  if (result.rowCount === 0) {
    throw new Error('Leg not found or does not belong to this trip');
  }
}

export async function reorderLegs(
  orderedIds: string[],
  tripId: string,
): Promise<void> {
  if (orderedIds.length === 0) return;
  // SEC-01: pre-flight ownership check rejects the entire reorder if any
  // leg id belongs to a different trip.
  const owned = await query<{ id: string }>(
    `SELECT id FROM trip_legs WHERE trip_id = $1 AND id = ANY($2::uuid[])`,
    [tripId, orderedIds],
  );
  if (owned.rows.length !== orderedIds.length) {
    throw new Error('One or more leg ids do not belong to this trip');
  }
  // Build a VALUES list of (uuid, order) pairs so every id is a query
  // parameter. String interpolation is intentionally avoided here to prevent
  // SQL injection via attacker-controlled leg IDs.
  const placeholders = orderedIds.map(
    (_, i) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::int)`,
  );
  const params: Array<string | number> = orderedIds.flatMap((id, i) => [
    id,
    i + 1,
  ]);
  await query(
    `UPDATE trip_legs
     SET leg_order = v.new_order
     FROM (VALUES ${placeholders.join(', ')}) AS v(leg_id, new_order)
     WHERE trip_legs.id = v.leg_id AND trip_legs.trip_id = $${params.length + 1}`,
    [...params, tripId],
  );
}
