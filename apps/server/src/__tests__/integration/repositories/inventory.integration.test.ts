import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { pool } from 'app/database/pool.js';
import { adjustInventoryConfidence } from 'app/repositories/inventory/adjustInventoryConfidence.js';
import { findInventoryItems } from 'app/repositories/inventory/findInventoryItems.js';
import { recordInventoryHit } from 'app/repositories/inventory/recordInventoryHit.js';
import { upsertDiscoveredItems } from 'app/repositories/inventory/upsertDiscoveredItems.js';

// Region sentinel keeps this suite's rows isolated and cleanable.
const TEST_REGION = 'itest-romania';

async function cleanInventoryRows() {
  await pool.query(`DELETE FROM inventory_items WHERE region LIKE 'itest-%'`);
}

function trainItem(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'train' as const,
    region: TEST_REGION,
    route_key: 'bucharest->brasov',
    title: 'Carpathia Express',
    provider: 'CFR Calatori',
    attributes: { class: 'sleeper' },
    indicative_price: 89.5,
    currency: 'EUR',
    booking_url: 'https://cfr.example/carpathia',
    source: 'web_search' as const,
    provenance: [
      {
        url: 'https://cfr.example/carpathia',
        fetched_at: '2026-07-06T00:00:00Z',
      },
    ],
    ...overrides,
  };
}

beforeEach(cleanInventoryRows);
afterAll(cleanInventoryRows);

describe('inventory repository integration', () => {
  it('upserts and finds items by kind and region', async () => {
    const inserted = await upsertDiscoveredItems([trainItem()]);
    expect(inserted).toBe(1);

    const items = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('Carpathia Express');
    expect(items[0]!.confidence).toBeCloseTo(0.4);
    expect(items[0]!.provenance).toHaveLength(1);
  });

  it('corroborates duplicates: one row, bumped confidence, merged provenance', async () => {
    await upsertDiscoveredItems([trainItem()]);
    await upsertDiscoveredItems([
      trainItem({
        provenance: [
          {
            url: 'https://rail.example/review',
            fetched_at: '2026-07-06T01:00:00Z',
          },
        ],
      }),
    ]);

    const items = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.confidence).toBeCloseTo(0.55);
    expect(items[0]!.provenance).toHaveLength(2);
  });

  it('treats the same title on different routes as distinct rows', async () => {
    await upsertDiscoveredItems([trainItem()]);
    await upsertDiscoveredItems([trainItem({ route_key: 'brasov->sibiu' })]);
    await upsertDiscoveredItems([trainItem({ route_key: null })]);

    const items = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
    });
    expect(items).toHaveLength(3);
  });

  it('filters by route key and by minimum confidence, ranked by confidence', async () => {
    await upsertDiscoveredItems([
      trainItem(),
      trainItem({ title: 'Slow Local', route_key: 'brasov->sibiu' }),
    ]);
    // Corroborate only the express so it outranks the local.
    await upsertDiscoveredItems([trainItem()]);

    const routed = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
      routeKey: 'bucharest->brasov',
    });
    expect(routed).toHaveLength(1);
    expect(routed[0]!.title).toBe('Carpathia Express');

    const confident = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
      minConfidence: 0.5,
    });
    expect(confident).toHaveLength(1);
    expect(confident[0]!.title).toBe('Carpathia Express');

    const all = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
    });
    expect(all[0]!.title).toBe('Carpathia Express'); // highest confidence first
  });

  it('records surfaced-to-user hits', async () => {
    await upsertDiscoveredItems([trainItem()]);
    const [item] = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
    });
    await recordInventoryHit(item!.id);
    await recordInventoryHit(item!.id);

    const [after] = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
    });
    expect(after!.hit_count).toBe(2);
  });

  it('clamps confidence adjustments to [0, 0.95]', async () => {
    await upsertDiscoveredItems([trainItem()]);
    const [item] = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
    });

    await adjustInventoryConfidence(item!.id, 5);
    let [after] = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
    });
    expect(after!.confidence).toBeCloseTo(0.95);

    await adjustInventoryConfidence(item!.id, -5);
    [after] = await findInventoryItems({
      kind: 'train',
      region: TEST_REGION,
      minConfidence: 0,
    });
    expect(after!.confidence).toBe(0);
  });
});
