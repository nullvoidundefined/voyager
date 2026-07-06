/**
 * Reads warm knowledge-base rows for a kind + region (optionally a specific
 * route), ranked by confidence then verification recency. Staleness policy is
 * the caller's concern: rows return with last_verified_at for the segment
 * search wrapper to judge against its per-kind freshness window.
 */
import { query } from 'app/database/pool.js';
import type {
  InventoryItem,
  InventoryQuery,
} from 'app/repositories/inventory/inventoryTypes.js';

const DEFAULT_MIN_CONFIDENCE = 0.3;
const DEFAULT_LIMIT = 10;

export async function findInventoryItems(
  input: InventoryQuery,
): Promise<InventoryItem[]> {
  const result = await query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE kind = $1
       AND region = $2
       AND ($3::varchar IS NULL OR route_key = $3)
       AND confidence >= $4
     ORDER BY confidence DESC, last_verified_at DESC
     LIMIT $5`,
    [
      input.kind,
      input.region,
      input.routeKey ?? null,
      input.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
      input.limit ?? DEFAULT_LIMIT,
    ],
  );
  return result.rows.map(normalizeInventoryRow);
}

/** pg returns NUMERIC as string and REAL as number; normalize for callers. */
function normalizeInventoryRow(row: InventoryItem): InventoryItem {
  return {
    ...row,
    indicative_price:
      row.indicative_price === null ? null : Number(row.indicative_price),
    confidence: Number(row.confidence),
  };
}
