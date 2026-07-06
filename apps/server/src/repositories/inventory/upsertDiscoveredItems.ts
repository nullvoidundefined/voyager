/**
 * Write-back for discovered offers: inserts new catalog rows and corroborates
 * duplicates (same kind + region + route + normalized title) by bumping
 * confidence, refreshing last_verified_at, and merging provenance. The model
 * never writes rows directly; providers validate and call this.
 */
import { query } from 'app/database/pool.js';
import type { NewInventoryItem } from 'app/repositories/inventory/inventoryTypes.js';

/** Corroboration bump per independent re-discovery, capped below certainty. */
const CORROBORATION_BUMP = 0.15;
const MAX_CONFIDENCE = 0.95;

export async function upsertDiscoveredItems(
  items: NewInventoryItem[],
): Promise<number> {
  let written = 0;
  for (const item of items) {
    const result = await query(
      `INSERT INTO inventory_items
         (kind, region, route_key, title, provider, attributes,
          indicative_price, currency, booking_url, source, provenance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (kind, region, coalesce(route_key, ''), md5(lower(title)))
       DO UPDATE SET
         confidence = LEAST(inventory_items.confidence + $12, $13),
         last_verified_at = NOW(),
         provenance = inventory_items.provenance || EXCLUDED.provenance,
         indicative_price = COALESCE(EXCLUDED.indicative_price, inventory_items.indicative_price),
         currency = COALESCE(EXCLUDED.currency, inventory_items.currency),
         booking_url = COALESCE(EXCLUDED.booking_url, inventory_items.booking_url),
         attributes = inventory_items.attributes || EXCLUDED.attributes`,
      [
        item.kind,
        item.region,
        item.route_key ?? null,
        item.title,
        item.provider ?? null,
        JSON.stringify(item.attributes ?? {}),
        item.indicative_price ?? null,
        item.currency ?? null,
        item.booking_url ?? null,
        item.source,
        JSON.stringify(item.provenance),
        CORROBORATION_BUMP,
        MAX_CONFIDENCE,
      ],
    );
    written += result.rowCount ?? 0;
  }
  return written;
}
