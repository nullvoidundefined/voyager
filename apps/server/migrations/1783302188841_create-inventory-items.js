/**
 * Create inventory_items: the durable, confidence-scored catalog of transport
 * and lodging options discovered via providers and web search, indexed by
 * kind + region/route. Distinct from the short-TTL Redis SerpApi cache: rows
 * accumulate across users and are re-verified rather than expired.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('inventory_items', {
    // Primary key
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    // Columns
    attributes: { type: 'jsonb', notNull: true, default: '{}' },
    booking_url: { type: 'text' },
    confidence: { type: 'real', notNull: true, default: 0.4 },
    currency: { type: 'text' },
    first_seen_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    hit_count: { type: 'integer', notNull: true, default: 0 },
    indicative_price: { type: 'numeric(10,2)' },
    kind: { type: 'varchar(24)', notNull: true },
    last_verified_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    provenance: { type: 'jsonb', notNull: true, default: '[]' },
    provider: { type: 'text' },
    region: { type: 'varchar(120)', notNull: true },
    route_key: { type: 'varchar(200)' },
    source: { type: 'varchar(24)', notNull: true },
    title: { type: 'text', notNull: true },
  });

  pgm.createIndex('inventory_items', ['kind', 'region', 'route_key'], {
    name: 'inventory_items_lookup',
  });
  pgm.sql(
    `CREATE UNIQUE INDEX inventory_items_dedupe
     ON inventory_items (kind, region, coalesce(route_key, ''), md5(lower(title)))`,
  );
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable('inventory_items');
};
