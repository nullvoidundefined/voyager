import { pool } from 'app/database/pool/pool.js';
import { randomUUID } from 'node:crypto';

const SENTINEL_DOMAIN = '@integration-test.invalid';

export async function seedUser(
  overrides: { email?: string; first_name?: string; last_name?: string } = {},
) {
  const id = randomUUID();
  const email = overrides.email ?? `${id}${SENTINEL_DOMAIN}`;
  const result = await pool.query(
    `INSERT INTO users (id, email, first_name, last_name, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
    [
      id,
      email,
      overrides.first_name ?? 'Test',
      overrides.last_name ?? 'User',
      'hash-not-used-in-repo-tests',
    ],
  );
  return result.rows[0];
}

export async function seedTrip(
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  const result = await pool.query(
    `INSERT INTO trips (user_id, destination, origin, departure_date, return_date, budget_total, travelers, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
    [
      userId,
      overrides.destination ?? 'Paris',
      overrides.origin ?? 'New York',
      overrides.departure_date ?? '2026-08-01',
      overrides.return_date ?? '2026-08-10',
      overrides.budget_total ?? 5000,
      overrides.travelers ?? 2,
      overrides.status ?? 'planning',
    ],
  );
  return result.rows[0];
}

export async function seedConversation(tripId: string) {
  const result = await pool.query(
    `INSERT INTO conversations (trip_id) VALUES ($1) RETURNING *`,
    [tripId],
  );
  return result.rows[0];
}

export async function seedSession(userId: string) {
  const tokenHash = randomUUID();
  const result = await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')
         RETURNING *`,
    [tokenHash, userId],
  );
  return { ...result.rows[0], rawTokenHash: tokenHash };
}
