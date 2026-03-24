import { query } from "app/db/pool/pool.js";
import type { UserPreferences, UserPreferencesInput } from "app/schemas/userPreferences.js";

export async function findByUserId(userId: string): Promise<UserPreferences | null> {
  const result = await query<UserPreferences>(
    "SELECT id, user_id, dietary, intensity, social, created_at, updated_at FROM user_preferences WHERE user_id = $1",
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function upsert(
  userId: string,
  input: UserPreferencesInput,
): Promise<UserPreferences> {
  const result = await query<UserPreferences>(
    `INSERT INTO user_preferences (user_id, dietary, intensity, social)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       dietary = EXCLUDED.dietary,
       intensity = EXCLUDED.intensity,
       social = EXCLUDED.social
     RETURNING id, user_id, dietary, intensity, social, created_at, updated_at`,
    [userId, input.dietary, input.intensity, input.social],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Upsert returned no row");
  return row;
}

export async function deleteByUserId(userId: string): Promise<boolean> {
  const result = await query("DELETE FROM user_preferences WHERE user_id = $1 RETURNING id", [
    userId,
  ]);
  return (result.rowCount ?? 0) > 0;
}
