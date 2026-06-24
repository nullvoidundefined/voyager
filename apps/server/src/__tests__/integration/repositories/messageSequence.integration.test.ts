import { describe, expect, it } from 'vitest';

import {
  seedConversation,
  seedTrip,
  seedUser,
} from 'app/__tests__/integration/helpers/seed.js';
import { pool } from 'app/database/pool.js';
import { insertMessage } from 'app/repositories/conversations.js';

async function seedConversationId(): Promise<string> {
  const user = await seedUser();
  const trip = await seedTrip(user.id);
  const conversation = await seedConversation(trip.id);
  return conversation.id as string;
}

describe('message sequence invariant integration', () => {
  it('assigns consecutive sequences to successive messages', async () => {
    const conversationId = await seedConversationId();

    const first = await insertMessage({
      conversation_id: conversationId,
      role: 'user',
      content: 'hello',
      nodes: [],
    });
    const second = await insertMessage({
      conversation_id: conversationId,
      role: 'assistant',
      content: 'hi',
      nodes: [],
    });

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
  });

  it('rejects two rows sharing a (conversation_id, sequence)', async () => {
    const conversationId = await seedConversationId();
    await insertMessage({
      conversation_id: conversationId,
      role: 'user',
      content: 'hello',
      nodes: [],
    });

    await expect(
      pool.query(
        `INSERT INTO messages (conversation_id, role, content, nodes, schema_version, sequence)
         VALUES ($1, 'assistant', 'dup', '[]'::jsonb, 1, 1)`,
        [conversationId],
      ),
    ).rejects.toThrow();
  });
});
