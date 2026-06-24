/**
 * Shared-trip data access: mints (idempotently) and resolves public share links.
 * One share link per (trip_id, created_by); a repeated share request returns the
 * existing link rather than minting a duplicate, so double-submits never
 * accumulate orphan public URLs.
 */
import { query } from 'app/database/pool.js';

export interface SharedTripRef {
  trip_id: string;
  created_by: string;
}

/** Returns the share id for (tripId, userId), creating it if absent. Idempotent. */
export async function createShareLink(
  tripId: string,
  userId: string,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO shared_trips (trip_id, created_by)
       VALUES ($1, $2)
       ON CONFLICT (trip_id, created_by) DO UPDATE SET trip_id = EXCLUDED.trip_id
       RETURNING id`,
    [tripId, userId],
  );
  return result.rows[0]!.id;
}

/** Resolves a share id to its trip reference, or null when the link is unknown. */
export async function getSharedTripRef(
  shareId: string,
): Promise<SharedTripRef | null> {
  const result = await query<SharedTripRef>(
    `SELECT trip_id, created_by FROM shared_trips WHERE id = $1`,
    [shareId],
  );
  return result.rows[0] ?? null;
}
