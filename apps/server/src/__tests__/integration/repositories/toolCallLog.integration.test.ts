import { describe, expect, it } from 'vitest';

import {
  seedConversation,
  seedTrip,
  seedUser,
} from 'app/__tests__/integration/helpers/seed.js';
import { pool } from 'app/database/pool.js';
import {
  getToolCallLogsByConversation,
  insertToolCallLog,
} from 'app/repositories/toolCallLog.js';

describe('toolCallLog repository integration', () => {
  describe('insertToolCallLog', () => {
    it('inserts a log entry and returns it with generated id', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);
      const conversation = await seedConversation(trip.id);

      const entry = await insertToolCallLog({
        conversation_id: conversation.id,
        tool_name: 'search_flights',
        tool_input_json: { origin: 'JFK', destination: 'CDG' },
        tool_result_json: { results: [] },
        latency_ms: 342,
        cache_hit: false,
        error: null,
      });

      expect(entry.id).toBeDefined();
      expect(entry.conversation_id).toBe(conversation.id);
      expect(entry.tool_name).toBe('search_flights');
      expect(entry.latency_ms).toBe(342);
      expect(entry.cache_hit).toBe(false);
      expect(entry.error).toBeNull();

      const dbResult = await pool.query(
        'SELECT * FROM tool_call_log WHERE id = $1',
        [entry.id],
      );
      expect(dbResult.rows).toHaveLength(1);
    });

    it('inserts a log entry with null conversation_id (orphan log)', async () => {
      const entry = await insertToolCallLog({
        conversation_id: null,
        tool_name: 'get_destination_info',
        tool_input_json: { destination: 'Tokyo' },
        tool_result_json: null,
        latency_ms: 10,
        cache_hit: true,
        error: null,
      });

      expect(entry.id).toBeDefined();
      expect(entry.conversation_id).toBeNull();

      // Cleanup this orphan row since it has no user to anchor cleanup
      await pool.query('DELETE FROM tool_call_log WHERE id = $1', [entry.id]);
    });

    it('records an error string when a tool call fails', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);
      const conversation = await seedConversation(trip.id);

      const entry = await insertToolCallLog({
        conversation_id: conversation.id,
        tool_name: 'search_hotels',
        tool_input_json: {},
        tool_result_json: null,
        latency_ms: 500,
        cache_hit: false,
        error: 'timeout after 500ms',
      });

      expect(entry.error).toBe('timeout after 500ms');
    });
  });

  describe('getToolCallLogsByConversation', () => {
    it('returns all log entries for a conversation ordered by created_at', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);
      const conversation = await seedConversation(trip.id);

      await insertToolCallLog({
        conversation_id: conversation.id,
        tool_name: 'search_flights',
        tool_input_json: {},
        tool_result_json: {},
        latency_ms: 100,
        cache_hit: false,
        error: null,
      });
      await insertToolCallLog({
        conversation_id: conversation.id,
        tool_name: 'search_hotels',
        tool_input_json: {},
        tool_result_json: {},
        latency_ms: 200,
        cache_hit: false,
        error: null,
      });

      const logs = await getToolCallLogsByConversation(conversation.id);

      expect(logs).toHaveLength(2);
      expect(logs[0]!.tool_name).toBe('search_flights');
      expect(logs[1]!.tool_name).toBe('search_hotels');
    });

    it('returns empty array for a conversation with no logs', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);
      const conversation = await seedConversation(trip.id);

      const logs = await getToolCallLogsByConversation(conversation.id);
      expect(logs).toHaveLength(0);
    });

    it('does not return logs from other conversations', async () => {
      const user = await seedUser();
      const trip1 = await seedTrip(user.id);
      const trip2 = await seedTrip(user.id);
      const conv1 = await seedConversation(trip1.id);
      const conv2 = await seedConversation(trip2.id);

      await insertToolCallLog({
        conversation_id: conv1.id,
        tool_name: 'search_flights',
        tool_input_json: {},
        tool_result_json: {},
        latency_ms: 50,
        cache_hit: false,
        error: null,
      });

      const logs = await getToolCallLogsByConversation(conv2.id);
      expect(logs).toHaveLength(0);
    });
  });
});
