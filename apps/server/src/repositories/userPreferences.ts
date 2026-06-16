import { query } from 'app/database/pool/pool.js';
import {
  type UserPreferences,
  normalizePreferences,
} from 'app/schemas/userPreferences/userPreferences.js';

export interface UserPreferencesRow {
  id: string;
  user_id: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function findByUserId(
  userId: string,
): Promise<UserPreferences | null> {
  const result = await query<UserPreferencesRow>(
    `SELECT * FROM user_preferences WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return normalizePreferences(row.preferences);
}

export async function upsert(
  userId: string,
  preferences: Partial<UserPreferences>,
): Promise<UserPreferences> {
  // Atomic JSONB merge at the DB level eliminates the read-then-write
  // race condition that existed when we did findByUserId + spread merge
  // in application code.
  const result = await query<UserPreferencesRow>(
    `INSERT INTO user_preferences (user_id, preferences)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET preferences = user_preferences.preferences || $2,
           updated_at = NOW()
     RETURNING *`,
    [userId, JSON.stringify(preferences)],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to upsert preferences');
  return normalizePreferences(row.preferences);
}

export async function deleteByUserId(userId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM user_preferences WHERE user_id = $1 RETURNING id`,
    [userId],
  );
  return (result.rowCount ?? 0) > 0;
}
