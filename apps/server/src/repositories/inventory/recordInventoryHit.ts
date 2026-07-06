/**
 * Increments a catalog row's surfaced-to-user counter, used for ranking and
 * pruning decisions.
 */
import { query } from 'app/database/pool.js';

export async function recordInventoryHit(id: string): Promise<void> {
  await query(
    `UPDATE inventory_items SET hit_count = hit_count + 1 WHERE id = $1`,
    [id],
  );
}
