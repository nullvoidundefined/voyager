export const up = (pgm) => {
  pgm.createTable('idempotency_keys', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: { type: 'uuid', notNull: true },
    key: { type: 'text', notNull: true },
    response_status: { type: 'integer', notNull: true },
    response_body: { type: 'jsonb', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  // First-writer-wins for concurrent double-submits sharing a key.
  pgm.addConstraint('idempotency_keys', 'idempotency_keys_user_id_key_unique', {
    unique: ['user_id', 'key'],
  });
  // Supports the TTL GC sweep over created_at.
  pgm.createIndex('idempotency_keys', 'created_at');
};

export const down = (pgm) => {
  pgm.dropTable('idempotency_keys');
};
