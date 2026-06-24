export const up = (pgm) => {
  // Collapse any duplicate items sharing a slot, keeping the earliest row, so a
  // retried plan_daily_schedule upserts cleanly instead of duplicating items.
  pgm.sql(`
    DELETE FROM trip_schedule_items a
    USING trip_schedule_items b
    WHERE a.schedule_id = b.schedule_id
      AND a.item_order = b.item_order
      AND a.ctid > b.ctid
  `);
  pgm.addConstraint('trip_schedule_items', 'trip_schedule_items_slot_unique', {
    unique: ['schedule_id', 'item_order'],
  });
};

export const down = (pgm) => {
  pgm.dropConstraint('trip_schedule_items', 'trip_schedule_items_slot_unique');
};
