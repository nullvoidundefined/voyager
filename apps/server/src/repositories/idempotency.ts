/**
 * Idempotency-key store: persists a captured (status, body) per (userId, key)
 * and replays it within a 24h TTL so a retried or double-submitted mutation
 * runs at most once. Backs the idempotencyGuard middleware. First-writer-wins
 * is enforced by the unique (user_id, key) index via ON CONFLICT DO NOTHING.
 */
import { query } from 'app/database/pool.js';

export interface StoredIdempotentResponse {
  responseBody: unknown;
  responseStatus: number;
}

const TTL_HOURS = 24;

/** Returns the stored response for (userId, key) within the TTL, or null. */
export async function findIdempotentResponse(
  userId: string,
  key: string,
): Promise<StoredIdempotentResponse | null> {
  const result = await query<{
    response_body: unknown;
    response_status: number;
  }>(
    `SELECT response_status, response_body
       FROM idempotency_keys
      WHERE user_id = $1 AND key = $2
        AND created_at > now() - ($3 || ' hours')::interval`,
    [userId, key, String(TTL_HOURS)],
  );
  const row = result.rows[0];
  return row
    ? { responseBody: row.response_body, responseStatus: row.response_status }
    : null;
}

/** Persists a captured response. First writer wins via the unique (user_id, key) index. */
export async function saveIdempotentResponse(
  userId: string,
  key: string,
  status: number,
  body: unknown,
): Promise<void> {
  await query(
    `INSERT INTO idempotency_keys (user_id, key, response_status, response_body)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, key) DO NOTHING`,
    [userId, key, status, JSON.stringify(body)],
  );
}

/** Deletes keys older than the TTL. Returns the number removed. Run on an interval. */
export async function deleteExpiredIdempotencyKeys(): Promise<number> {
  const result = await query(
    `DELETE FROM idempotency_keys WHERE created_at < now() - ($1 || ' hours')::interval`,
    [String(TTL_HOURS)],
  );
  return result.rowCount ?? 0;
}
