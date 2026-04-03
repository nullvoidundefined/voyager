export const up = (pgm) => {
  pgm.addColumns('conversations', {
    booking_state: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func(
        `'{"flights":{"status":"idle"},"hotels":{"status":"idle"},"car_rental":{"status":"idle"},"experiences":{"status":"idle"}}'::jsonb`,
      ),
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('conversations', ['booking_state']);
};
