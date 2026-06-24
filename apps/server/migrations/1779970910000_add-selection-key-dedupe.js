const SELECTION_TABLES = [
  'trip_flights',
  'trip_hotels',
  'trip_car_rentals',
  'trip_experiences',
];

export const up = (pgm) => {
  for (const table of SELECTION_TABLES) {
    // Nullable first so existing rows can be backfilled before the NOT NULL.
    pgm.addColumn(table, { selection_key: { type: 'text' } });
    // Backfill existing rows with their own id so no two collide; new rows get
    // a natural-key value from the application layer.
    pgm.sql(
      `UPDATE ${table} SET selection_key = id::text WHERE selection_key IS NULL`,
    );
    pgm.alterColumn(table, 'selection_key', { notNull: true });
    pgm.addConstraint(table, `${table}_trip_selection_key_unique`, {
      unique: ['trip_id', 'selection_key'],
    });
  }
};

export const down = (pgm) => {
  for (const table of SELECTION_TABLES) {
    pgm.dropConstraint(table, `${table}_trip_selection_key_unique`);
    pgm.dropColumn(table, 'selection_key');
  }
};
