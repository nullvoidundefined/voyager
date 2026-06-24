export const up = (pgm) => {
  // Collapse any pre-existing duplicate share links, keeping the earliest row
  // per (trip_id, created_by) so the canonical link survives.
  pgm.sql(`
    DELETE FROM shared_trips a
    USING shared_trips b
    WHERE a.trip_id = b.trip_id
      AND a.created_by = b.created_by
      AND a.ctid > b.ctid
  `);
  pgm.addConstraint('shared_trips', 'shared_trips_trip_creator_unique', {
    unique: ['trip_id', 'created_by'],
  });
};

export const down = (pgm) => {
  pgm.dropConstraint('shared_trips', 'shared_trips_trip_creator_unique');
};
