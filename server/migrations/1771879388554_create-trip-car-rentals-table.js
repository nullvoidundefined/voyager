export const up = (pgm) => {
  pgm.createTable('trip_car_rentals', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    trip_id: {
      type: 'uuid',
      notNull: true,
      references: 'trips',
      onDelete: 'CASCADE',
    },
    provider: { type: 'text', notNull: true },
    car_name: { type: 'text', notNull: true },
    car_type: { type: 'text', notNull: true },
    price_per_day: { type: 'numeric(10,2)', notNull: true },
    total_price: { type: 'numeric(10,2)', notNull: true },
    currency: { type: 'varchar(3)', notNull: true, default: 'USD' },
    pickup_location: { type: 'text' },
    dropoff_location: { type: 'text' },
    pickup_date: { type: 'date' },
    dropoff_date: { type: 'date' },
    features: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    image_url: { type: 'text' },
    data_json: { type: 'jsonb' },
    selected: { type: 'boolean', notNull: true, default: false },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('trip_car_rentals', 'trip_id');
};

export const down = (pgm) => {
  pgm.dropTable('trip_car_rentals');
};
