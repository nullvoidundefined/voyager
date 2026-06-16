import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { pool } from 'app/database/pool.js';
import {
  createSession,
  createUser,
  createUserAndSession,
  deleteExpiredSessions,
  deleteSession,
  findUserByEmail,
  findUserById,
  getSessionWithUser,
  loginUser,
} from 'app/repositories/auth.js';

import { seedUser } from '../helpers/seed.js';

const DOMAIN = '@integration-test.invalid';

function uniqueEmail() {
  return `auth-repo-${crypto.randomUUID()}${DOMAIN}`;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

describe('auth repository integration', () => {
  // Track created user IDs for cleanup
  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      const placeholders = createdUserIds.map((_, i) => `$${i + 1}`).join(', ');
      await pool.query(
        `DELETE FROM sessions WHERE user_id IN (${placeholders})`,
        createdUserIds,
      );
      await pool.query(
        `DELETE FROM users WHERE id IN (${placeholders})`,
        createdUserIds,
      );
      createdUserIds.length = 0;
    }
  });

  describe('createUser', () => {
    it('inserts a user row and returns the user without password_hash', async () => {
      const email = uniqueEmail();
      const user = await createUser(email, 'password123', 'Jane', 'Doe');
      createdUserIds.push(user.id);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(email.toLowerCase().trim());
      expect(user.first_name).toBe('Jane');
      expect(user.last_name).toBe('Doe');
      expect((user as Record<string, unknown>).password_hash).toBeUndefined();

      // Verify it actually exists in the DB
      const dbResult = await pool.query('SELECT * FROM users WHERE id = $1', [
        user.id,
      ]);
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].email).toBe(email.toLowerCase().trim());
    });

    it('normalizes email to lowercase', async () => {
      const email = `UPPER-${crypto.randomUUID()}${DOMAIN}`;
      const user = await createUser(email, 'password123', 'Jane', 'Doe');
      createdUserIds.push(user.id);

      expect(user.email).toBe(email.toLowerCase().trim());
    });
  });

  describe('findUserByEmail', () => {
    it('returns the user with password_hash when found', async () => {
      const seeded = await seedUser({ email: uniqueEmail() });
      createdUserIds.push(seeded.id);

      const found = await findUserByEmail(seeded.email);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(seeded.id);
      expect(found!.email).toBe(seeded.email);
      expect(found!.password_hash).toBeDefined();
    });

    it('returns null when user does not exist', async () => {
      const result = await findUserByEmail(
        `nonexistent-${crypto.randomUUID()}${DOMAIN}`,
      );
      expect(result).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('returns the user when found', async () => {
      const seeded = await seedUser({ email: uniqueEmail() });
      createdUserIds.push(seeded.id);

      const found = await findUserById(seeded.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(seeded.id);
    });

    it('returns null for an unknown id', async () => {
      const result = await findUserById(crypto.randomUUID());
      expect(result).toBeNull();
    });
  });

  describe('createSession', () => {
    it('inserts a session row and returns the raw token', async () => {
      const seeded = await seedUser({ email: uniqueEmail() });
      createdUserIds.push(seeded.id);

      const token = await createSession(seeded.id);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      const idHash = hashToken(token);
      const dbResult = await pool.query(
        'SELECT * FROM sessions WHERE id = $1',
        [idHash],
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].user_id).toBe(seeded.id);
    });
  });

  describe('getSessionWithUser', () => {
    it('returns user for a valid non-expired session', async () => {
      const seeded = await seedUser({ email: uniqueEmail() });
      createdUserIds.push(seeded.id);
      const token = await createSession(seeded.id);

      const user = await getSessionWithUser(token);
      expect(user).not.toBeNull();
      expect(user!.id).toBe(seeded.id);
      expect(user!.email).toBe(seeded.email);
    });

    it('returns null for an unknown token', async () => {
      const result = await getSessionWithUser('notarealtoken');
      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('removes the session and returns true', async () => {
      const seeded = await seedUser({ email: uniqueEmail() });
      createdUserIds.push(seeded.id);
      const token = await createSession(seeded.id);

      const deleted = await deleteSession(token);
      expect(deleted).toBe(true);

      const idHash = hashToken(token);
      const dbResult = await pool.query(
        'SELECT * FROM sessions WHERE id = $1',
        [idHash],
      );
      expect(dbResult.rows).toHaveLength(0);
    });

    it('returns false for an unknown token', async () => {
      const result = await deleteSession('notthere');
      expect(result).toBe(false);
    });
  });

  describe('deleteExpiredSessions', () => {
    it('removes expired sessions and returns the count', async () => {
      const seeded = await seedUser({ email: uniqueEmail() });
      createdUserIds.push(seeded.id);

      // Insert an already-expired session directly
      const expiredId = hashToken(crypto.randomUUID());
      await pool.query(
        `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, NOW() - INTERVAL '1 minute')`,
        [expiredId, seeded.id],
      );

      const count = await deleteExpiredSessions();
      expect(count).toBeGreaterThanOrEqual(1);

      const dbResult = await pool.query(
        'SELECT * FROM sessions WHERE id = $1',
        [expiredId],
      );
      expect(dbResult.rows).toHaveLength(0);
    });
  });

  describe('loginUser', () => {
    it('deletes existing sessions and creates a new one', async () => {
      const seeded = await seedUser({ email: uniqueEmail() });
      createdUserIds.push(seeded.id);

      const oldToken = await createSession(seeded.id);
      const oldHash = hashToken(oldToken);

      const newToken = await loginUser(seeded.id);
      expect(typeof newToken).toBe('string');

      // Old session gone
      const oldResult = await pool.query(
        'SELECT * FROM sessions WHERE id = $1',
        [oldHash],
      );
      expect(oldResult.rows).toHaveLength(0);

      // New session present
      const newHash = hashToken(newToken);
      const newResult = await pool.query(
        'SELECT * FROM sessions WHERE id = $1',
        [newHash],
      );
      expect(newResult.rows).toHaveLength(1);
    });
  });

  describe('createUserAndSession', () => {
    it('creates user and session in a transaction', async () => {
      const email = uniqueEmail();
      const { user, sessionId } = await createUserAndSession(
        email,
        'password123',
        'Alice',
        'Smith',
      );
      createdUserIds.push(user.id);

      expect(user.email).toBe(email.toLowerCase().trim());
      expect(typeof sessionId).toBe('string');

      const idHash = hashToken(sessionId);
      const sessionResult = await pool.query(
        'SELECT * FROM sessions WHERE id = $1',
        [idHash],
      );
      expect(sessionResult.rows).toHaveLength(1);
      expect(sessionResult.rows[0].user_id).toBe(user.id);
    });

    it('throws on duplicate email', async () => {
      const email = uniqueEmail();
      const { user } = await createUserAndSession(
        email,
        'password123',
        'Alice',
        'Smith',
      );
      createdUserIds.push(user.id);

      await expect(
        createUserAndSession(email, 'password456', 'Bob', 'Jones'),
      ).rejects.toMatchObject({ code: '23505' });
    });
  });
});
