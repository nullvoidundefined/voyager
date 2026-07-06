/**
 * Raises or lowers a catalog row's confidence (corroboration or failed
 * re-verification), clamped to [0, 0.95] so no row ever reads as certain.
 */
import { query } from 'app/database/pool.js';

const MIN_CONFIDENCE = 0;
const MAX_CONFIDENCE = 0.95;

export async function adjustInventoryConfidence(
  id: string,
  delta: number,
): Promise<void> {
  await query(
    `UPDATE inventory_items
     SET confidence = GREATEST($2, LEAST($3, confidence + $4))
     WHERE id = $1`,
    [id, MIN_CONFIDENCE, MAX_CONFIDENCE, delta],
  );
}
