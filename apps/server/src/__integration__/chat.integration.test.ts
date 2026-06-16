/**
 * Chat handler integration test.
 *
 * Source of mandate: the 2026-04-06 retrospective found that ChatBox
 * fix storms originated at the seam between server SSE frames and
 * client node parsing. Unit tests mock the Anthropic SDK
 * (apps/server/src/services/agent/agentService.test.ts) AND mock the
 * conversations repository (apps/server/src/handlers/chat/chat.test.ts),
 * so the only contract that exercises both layers together is the
 * mocked Playwright E2E suite. That suite catches UI regressions but
 * does not assert against the persisted message shape; if a node
 * round-trips through the DB malformed, it surfaces as a downstream
 * ChatBox bug rather than a chat-handler test failure.
 *
 * This spec closes that gap. It exercises the chat surface end-to-end
 * with:
 *   - real Postgres (via app/database/pool, the integration runner's pool)
 *   - real repositories (no vi.mock of conversations / trips / users)
 *   - real Express app (the same `app` shipped to production)
 *   - mocked Anthropic SDK (via E2E_MOCK_ANTHROPIC=1, the deterministic
 *     MockAnthropicClient that powers the Playwright fast lane)
 *   - mocked tool adapters (via E2E_MOCK_TOOLS=1, so no SerpApi /
 *     Google Places quota is consumed)
 *
 * Invariants covered:
 *   1. The chat endpoint emits a well-formed SSE stream that
 *      terminates with `event: done` carrying the persisted assistant
 *      message.
 *   2. The SSE done payload's nodes equal what was persisted to the
 *      messages.nodes column. (A divergence here is the exact failure
 *      mode that produced past ChatBox storms.)
 *   3. The conversation row holds exactly two messages after one turn
 *      (user + assistant), in sequence order, with monotonically
 *      increasing `sequence`.
 *   4. GET /trips/:id/messages returns those messages with nodes
 *      intact (the reload-persistence contract).
 *   5. A second user turn appends two more messages without losing
 *      history.
 *
 * NOT covered here (deliberate scope):
 *   - The actual Anthropic SDK contract. That belongs in a separate
 *     fixture-replay test (R-200 "LLM consumers include one fixture
 *     test against a real captured response").
 *   - Tile selection persistence (`confirmedId` on the trip GET).
 *     That belongs in trip-selections.integration.test.ts when ENG-17
 *     lands.
 */
import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from 'app/app.js';
import { pool } from 'app/database/pool.js';

const TEST_EMAIL = 'chat-integration@integration-test.invalid';
const TEST_PASSWORD = 'testpassword123';

interface SSEEvent {
  event: string;
  data: unknown;
}

/**
 * Parse a raw SSE response body into a list of `{ event, data }`
 * objects. Events are separated by `\n\n`; each event has lines
 * `event: name` and `data: <json>`. Anything that does not match
 * this shape is ignored (defensive against keepalive comments).
 */
function parseSSE(body: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = body.split('\n\n');
  for (const block of blocks) {
    const lines = block.split('\n');
    let eventName = '';
    let dataLine = '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLine = line.slice('data:'.length).trim();
      }
    }
    if (eventName && dataLine) {
      try {
        events.push({ event: eventName, data: JSON.parse(dataLine) });
      } catch {
        events.push({ event: eventName, data: dataLine });
      }
    }
  }
  return events;
}

interface DoneEventPayload {
  type: 'done';
  message: {
    id: string;
    role: 'assistant';
    nodes: unknown[];
    sequence: number;
    created_at: string;
  };
}

function isDonePayload(value: unknown): value is DoneEventPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type !== 'done') return false;
  const m = v.message as Record<string, unknown> | undefined;
  if (!m || typeof m !== 'object') return false;
  return (
    typeof m.id === 'string' &&
    m.role === 'assistant' &&
    Array.isArray(m.nodes) &&
    typeof m.sequence === 'number'
  );
}

describe('chat handler integration', () => {
  let server: Server;
  let sessionCookie = '';
  let tripId = '';

  beforeAll(async () => {
    // Engage the deterministic mock Anthropic SDK and the mock tool
    // adapters. Both flags are inspected at request time, so setting
    // them here (after module load but before the first request) is
    // sufficient. setup.ts already sets E2E_BYPASS_RATE_LIMITS=1.
    process.env.E2E_MOCK_ANTHROPIC = '1';
    process.env.E2E_MOCK_TOOLS = '1';

    if (!process.env.DATABASE_URL) {
      // Skip the whole describe when no DB is wired; matches the
      // pattern in setup.ts.
      return;
    }

    server = app.listen(0);

    // Register a fresh user. The sentinel suffix routes cleanup
    // through setup.ts's afterAll.
    const reg = await request(server)
      .post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        first_name: 'Chat',
        last_name: 'Integration',
      });
    if (reg.status !== 201) {
      throw new Error(
        `Register failed in beforeAll: ${reg.status} ${JSON.stringify(reg.body)}`,
      );
    }
    sessionCookie =
      (reg.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('sid'),
      ) ?? '';
    if (!sessionCookie) throw new Error('Register did not return sid cookie');

    // Create a trip. Destination matches the mock client's scripted
    // tool calls (search_flights DEN->SFO, search_hotels in San
    // Francisco) so the resulting nodes are non-empty and meaningful.
    const tripRes = await request(server)
      .post('/trips')
      .set('Cookie', sessionCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        destination: 'San Francisco',
        origin: 'Denver',
        departure_date: '2026-06-01',
        return_date: '2026-06-04',
        budget_total: 2500,
        travelers: 2,
      });
    if (tripRes.status !== 201) {
      throw new Error(
        `Create trip failed in beforeAll: ${tripRes.status} ${JSON.stringify(tripRes.body)}`,
      );
    }
    tripId = tripRes.body.trip?.id ?? tripRes.body.id;
    if (!tripId) {
      throw new Error(
        `Create trip returned no id: ${JSON.stringify(tripRes.body)}`,
      );
    }
  });

  afterAll(() => {
    server?.close();
    // DB cleanup is handled by setup.ts's afterAll via the sentinel
    // email match. Do not close the pool here; setup.ts owns it.
  });

  it('emits a well-formed SSE stream ending with done and persists user + assistant messages', async () => {
    if (!process.env.DATABASE_URL) return;

    const res = await request(server)
      .post(`/trips/${tripId}/chat`)
      .set('Cookie', sessionCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ message: 'Plan a 3-day trip to San Francisco' })
      .buffer(true)
      .parse((res2, callback) => {
        const chunks: Buffer[] = [];
        res2.on('data', (chunk: Buffer) => chunks.push(chunk));
        res2.on('end', () => callback(null, Buffer.concat(chunks).toString()));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);

    const events = parseSSE(res.body as string);

    // Invariant 1: stream is non-empty and terminates with done.
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last?.event).toBe('done');
    expect(isDonePayload(last?.data)).toBe(true);

    // Should never see an error event on the happy path.
    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeUndefined();

    // Should see at least one node event before done (enrichment,
    // tool results, or assistant text). The mock script produces
    // search_flights + search_hotels, so flight_tiles + hotel_tiles
    // should both arrive on the stream.
    const nodeEvents = events.filter((e) => e.event === 'node');
    expect(nodeEvents.length).toBeGreaterThan(0);

    if (!isDonePayload(last?.data)) {
      throw new Error('done payload shape narrowed but TS guard rejected');
    }
    const donePayload = last.data;
    const assistantNodes = donePayload.message.nodes;

    // Invariant 2: persisted assistant.nodes equals the done
    // payload's nodes. This is the seam.
    const dbRow = await pool.query<{
      id: string;
      role: string;
      nodes: unknown;
      sequence: number;
    }>(`SELECT id, role, nodes, sequence FROM messages WHERE id = $1`, [
      donePayload.message.id,
    ]);
    expect(dbRow.rows.length).toBe(1);
    const row = dbRow.rows[0]!;
    expect(row.role).toBe('assistant');
    expect(row.nodes).toEqual(assistantNodes);
    expect(row.sequence).toBe(donePayload.message.sequence);

    // Invariant 3: exactly two messages persisted (user + assistant),
    // sequence increasing.
    const all = await pool.query<{
      role: string;
      sequence: number;
      content: string;
      nodes: unknown[] | null;
    }>(
      `SELECT m.role, m.sequence, m.content, m.nodes
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.trip_id = $1
        ORDER BY m.sequence ASC`,
      [tripId],
    );
    expect(all.rows.length).toBe(2);
    expect(all.rows[0]?.role).toBe('user');
    expect(all.rows[1]?.role).toBe('assistant');
    expect(all.rows[0]?.sequence).toBeLessThan(all.rows[1]!.sequence);

    // The user message should round-trip its content into a text node
    // (the handler does this explicitly).
    expect(all.rows[0]?.nodes).toEqual([
      { type: 'text', content: 'Plan a 3-day trip to San Francisco' },
    ]);
  });

  it('GET /trips/:id/messages returns the persisted turn with nodes intact', async () => {
    if (!process.env.DATABASE_URL) return;

    const res = await request(server)
      .get(`/trips/${tripId}/messages`)
      .set('Cookie', sessionCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages.length).toBe(2);

    const [first, second] = res.body.messages as Array<{
      role: string;
      nodes: unknown[];
      sequence: number;
    }>;

    expect(first?.role).toBe('user');
    expect(Array.isArray(first?.nodes)).toBe(true);
    expect(first?.nodes.length).toBeGreaterThan(0);

    expect(second?.role).toBe('assistant');
    expect(Array.isArray(second?.nodes)).toBe(true);
    expect(second?.nodes.length).toBeGreaterThan(0);

    expect(first!.sequence).toBeLessThan(second!.sequence);
  });

  it('a second user turn appends without losing history', async () => {
    if (!process.env.DATABASE_URL) return;

    const res = await request(server)
      .post(`/trips/${tripId}/chat`)
      .set('Cookie', sessionCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ message: "I'll take the cheapest flight" })
      .buffer(true)
      .parse((res2, callback) => {
        const chunks: Buffer[] = [];
        res2.on('data', (chunk: Buffer) => chunks.push(chunk));
        res2.on('end', () => callback(null, Buffer.concat(chunks).toString()));
      });

    expect(res.status).toBe(200);
    const events = parseSSE(res.body as string);
    const last = events[events.length - 1];
    expect(last?.event).toBe('done');

    const all = await pool.query<{ role: string; sequence: number }>(
      `SELECT m.role, m.sequence
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.trip_id = $1
        ORDER BY m.sequence ASC`,
      [tripId],
    );
    expect(all.rows.length).toBe(4);
    expect(all.rows.map((r) => r.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);

    // Sequences are strictly increasing.
    for (let i = 1; i < all.rows.length; i++) {
      expect(all.rows[i]!.sequence).toBeGreaterThan(all.rows[i - 1]!.sequence);
    }
  });
});
