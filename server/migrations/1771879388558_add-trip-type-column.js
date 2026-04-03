export const up = (pgm) => {
  pgm.addColumn('trips', {
    trip_type: {
      type: 'text',
      notNull: true,
      default: 'round_trip',
      check: "trip_type IN ('round_trip', 'one_way')",
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('trips', 'trip_type');
};
