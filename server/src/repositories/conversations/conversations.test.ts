import { query } from 'app/db/pool/pool.js';
import {
  getMessagesByConversation,
  getOrCreateConversation,
  insertMessage,
} from 'app/repositories/conversations/conversations.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/db/pool/pool.js', () => ({
  query: vi.fn(),
}));

describe('conversations repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getOrCreateConversation', () => {
    it('returns existing conversation for a trip', async () => {
      const existing = {
        id: 'conv-1',
        trip_id: 'trip-1',
        created_at: '2026-01-01',
      };
      vi.mocked(query).mockResolvedValueOnce({
        rows: [existing],
        rowCount: 1,
      } as never);

      const result = await getOrCreateConversation('trip-1');

      expect(result).toEqual(existing);
      const sql = vi.mocked(query).mock.calls[0]![0] as string;
      expect(sql).toContain('INSERT INTO conversations');
      expect(sql).toContain('ON CONFLICT');
    });

    it('creates new conversation if none exists', async () => {
      const created = {
        id: 'conv-new',
        trip_id: 'trip-2',
        created_at: '2026-01-01',
      };
      vi.mocked(query).mockResolvedValueOnce({
        rows: [created],
        rowCount: 1,
      } as never);

      const result = await getOrCreateConversation('trip-2');

      expect(result.id).toBe('conv-new');
    });
  });

  describe('insertMessage', () => {
    it('inserts a user message', async () => {
      const msg = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Plan a trip',
        tool_calls_json: null,
        token_count: null,
        created_at: '2026-01-01',
      };
      vi.mocked(query).mockResolvedValueOnce({
        rows: [msg],
        rowCount: 1,
      } as never);

      const result = await insertMessage({
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Plan a trip',
      });

      expect(result).toEqual(msg);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('inserts an assistant message with tool calls', async () => {
      const toolCalls = [{ tool_name: 'search_flights', input: {} }];
      const msg = {
        id: 'msg-2',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Found flights.',
        tool_calls_json: toolCalls,
        token_count: 75,
        created_at: '2026-01-01',
      };
      vi.mocked(query).mockResolvedValueOnce({
        rows: [msg],
        rowCount: 1,
      } as never);

      const result = await insertMessage({
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Found flights.',
        tool_calls_json: toolCalls,
        token_count: 75,
      });

      expect(result.tool_calls_json).toEqual(toolCalls);
    });
  });

  describe('getMessagesByConversation', () => {
    it('returns messages ordered by created_at', async () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hi',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hello!',
          created_at: '2026-01-01T00:01:00Z',
        },
      ];
      vi.mocked(query).mockResolvedValueOnce({
        rows: messages,
        rowCount: 2,
      } as never);

      const result = await getMessagesByConversation('conv-1');

      expect(result).toHaveLength(2);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY'), [
        'conv-1',
      ]);
    });

    it('returns empty array for conversation with no messages', async () => {
      vi.mocked(query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as never);

      const result = await getMessagesByConversation('conv-999');

      expect(result).toEqual([]);
    });
  });
});
