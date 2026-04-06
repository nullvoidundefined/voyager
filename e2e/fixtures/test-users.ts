/**
 * Test user factories.
 *
 * Each factory returns a deterministic-but-unique user definition.
 * `seedUser()` creates the user via the backend /auth/register
 * endpoint and returns the credentials. Cleanup is left to the
 * test database tear-down (scripts/seed-test-db.ts handles that
 * before the next run).
 */

const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:3001';

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

function uniq(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@integration-test.invalid`;
}

export function newUser(): TestUser {
  return {
    email: uniq('e2e-new'),
    password: 'testpassword123',
    firstName: 'New',
    lastName: 'User',
  };
}

export function existingUser(): TestUser {
  return {
    email: uniq('e2e-existing'),
    password: 'testpassword123',
    firstName: 'Existing',
    lastName: 'User',
  };
}

export function userWithTrips(): TestUser {
  return {
    email: uniq('e2e-trips'),
    password: 'testpassword123',
    firstName: 'Trip',
    lastName: 'Owner',
  };
}

export function userWithCompletedPreferences(): TestUser {
  return {
    email: uniq('e2e-prefs-complete'),
    password: 'testpassword123',
    firstName: 'Pref',
    lastName: 'Complete',
  };
}

export function userWithIncompletePreferences(): TestUser {
  return {
    email: uniq('e2e-prefs-partial'),
    password: 'testpassword123',
    firstName: 'Pref',
    lastName: 'Partial',
  };
}

/**
 * Create the user via the API. Returns the original user object
 * unchanged so call sites can chain into login helpers.
 *
 * Note: this is a request-side helper, not a Playwright fixture.
 * It does not touch a Page. Call from within `test.beforeEach` or
 * directly inside a test before calling helpers/auth.login(page, ...).
 */
export async function seedUser(user: TestUser): Promise<TestUser> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      first_name: user.firstName,
      last_name: user.lastName,
    }),
  });

  if (res.status !== 201 && res.status !== 409) {
    throw new Error(
      `seedUser failed: ${res.status} ${await res.text().catch(() => '')}`,
    );
  }
  return user;
}
