import { describe, expect, it } from 'vitest';

import { seedUser } from 'app/__tests__/integration/helpers/seed.js';
import { pool } from 'app/database/pool.js';
import {
  deleteExpiredIdempotencyKeys,
  findIdempotentResponse,
  saveIdempotentResponse,
} from 'app/repositories/idempotency.js';

const KEY = 'idem-key-1';

describe('idempotency repository integration', () => {
  it('saves and replays a response for (userId, key)', async () => {
    const user = await seedUser();

    await saveIdempotentResponse(user.id, KEY, 201, { created: true });
    const stored = await findIdempotentResponse(user.id, KEY);

    expect(stored).toEqual({
      responseStatus: 201,
      responseBody: { created: true },
    });
  });

  it('is first-writer-wins: a second save with the same key is ignored', async () => {
    const user = await seedUser();

    await saveIdempotentResponse(user.id, KEY, 201, { n: 1 });
    await saveIdempotentResponse(user.id, KEY, 201, { n: 2 });
    const stored = await findIdempotentResponse(user.id, KEY);

    expect(stored?.responseBody).toEqual({ n: 1 });
    const dbResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM idempotency_keys WHERE user_id = $1 AND key = $2',
      [user.id, KEY],
    );
    expect(dbResult.rows[0].count).toBe(1);
  });

  it('does not replay a key older than the TTL and GC removes it', async () => {
    const user = await seedUser();

    await pool.query(
      `INSERT INTO idempotency_keys (user_id, key, response_status, response_body, created_at)
       VALUES ($1, $2, 200, $3, now() - interval '25 hours')`,
      [user.id, KEY, JSON.stringify({ stale: true })],
    );

    const stored = await findIdempotentResponse(user.id, KEY);
    expect(stored).toBeNull();

    const removed = await deleteExpiredIdempotencyKeys();
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
