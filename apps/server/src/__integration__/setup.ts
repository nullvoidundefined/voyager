import 'dotenv/config';
import { afterAll, beforeAll } from 'vitest';

import { pool } from 'app/database/pool/pool.js';

// Bypass the rate limiter for the integration test process. The
// integration tests fire dozens of /auth/register and /auth/login
// requests in the same vitest process from the same IP, which
// would otherwise trip the auth rate limiter (10 per 15 min) and
// 429 every test after the limit. Unit tests bypass via vi.mock;
// integration tests bypass via the env flag the rate limiter
// already understands. The flag is also set in playwright.config.ts
// for the same reason.
process.env.E2E_BYPASS_RATE_LIMITS = '1';

const SENTINEL = '%@integration-test.invalid';

async function cleanTestData() {
  // Children before parents, respecting FK constraints.
  // agent_turn_cost -> conversations -> trips -> users
  await pool.query(
    `DELETE FROM agent_turn_cost WHERE conversation_id IN (SELECT id FROM conversations WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)))`,
    [SENTINEL],
  );
  await pool.query(
    `DELETE FROM tool_call_log WHERE conversation_id IN (SELECT id FROM conversations WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)))`,
    [SENTINEL],
  );
  await pool.query(
    `DELETE FROM user_preferences WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    [SENTINEL],
  );
  await pool.query(
    `DELETE FROM conversations WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))`,
    [SENTINEL],
  );
  await pool.query(
    `DELETE FROM trip_car_rentals WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))`,
    [SENTINEL],
  );
  await pool.query(
    `DELETE FROM trip_experiences WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))`,
    [SENTINEL],
  );
  await pool.query(
    `DELETE FROM trip_hotels WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))`,
    [SENTINEL],
  );
  await pool.query(
    `DELETE FROM trip_flights WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))`,
    [SENTINEL],
  );
  await pool.query(
    `DELETE FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    [SENTINEL],
  );
  await pool.query(
    `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    [SENTINEL],
  );
  await pool.query(`DELETE FROM users WHERE email LIKE $1`, [SENTINEL]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set; skipping integration tests');
    return;
  }

  // Clean test data from previous runs
  await cleanTestData();
});

afterAll(async () => {
  // Clean up test data
  await cleanTestData();
  await pool.end();
});
