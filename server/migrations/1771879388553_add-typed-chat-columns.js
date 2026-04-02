exports.up = (pgm) => {
  pgm.addColumns('messages', {
    nodes: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
    },
    schema_version: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    sequence: {
      type: 'integer',
    },
  });

  // Backfill sequence from created_at ordering per conversation
  pgm.sql(`
    WITH numbered AS (
      SELECT id, conversation_id,
        ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at) AS seq
      FROM messages
    )
    UPDATE messages SET sequence = numbered.seq
    FROM numbered WHERE messages.id = numbered.id
  `);

  // Now make sequence NOT NULL
  pgm.alterColumn('messages', 'sequence', { notNull: true });

  // Backfill nodes for existing text messages
  pgm.sql(`
    UPDATE messages
    SET nodes = jsonb_build_array(
      jsonb_build_object('type', 'text', 'content', COALESCE(content, ''))
    )
    WHERE role IN ('user', 'assistant') AND content IS NOT NULL
  `);

  pgm.createIndex('messages', ['conversation_id', 'sequence'], {
    unique: true,
    name: 'messages_conversation_sequence',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('messages', ['conversation_id', 'sequence'], {
    name: 'messages_conversation_sequence',
  });
  pgm.dropColumns('messages', ['nodes', 'schema_version', 'sequence']);
};
