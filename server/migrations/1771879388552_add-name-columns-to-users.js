/**
 * Add first_name and last_name columns to users table.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumns("users", {
    first_name: { type: "text", notNull: false },
    last_name: { type: "text", notNull: false },
  });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropColumns("users", ["first_name", "last_name"]);
};
