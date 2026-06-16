import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as chatHandlers from 'app/handlers/chat/chat.js';
import { errorHandler } from 'app/middleware/errorHandler.js';
import * as convRepo from 'app/repositories/conversations.js';
import * as tripRepo from 'app/repositories/trips/trips.js';
import * as agentService from 'app/services/agent/agentService.js';
import { uuid } from 'app/test-fixtures/uuids.js';

vi.mock('app/repositories/conversations.js');
vi.mock('app/repositories/trips/trips.js');
vi.mock('app/repositories/userPreferences.js');
vi.mock('app/services/agent/agentService.js');
vi.mock('app/tools/mock/isMockMode.js', () => ({
  isMockMode: vi.fn().mockReturnValue(false),
}));
vi.mock('app/services/external/enrichment.js', () => ({
  getEnrichmentNodes: vi.fn().mockResolvedValue([]),
}));
vi.mock('app/clients/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// P2-01: capture redis.set / redis.del calls so the test can assert
// the Redis lock layer is wired (in addition to the in-memory Set).
const mockRedisSet = vi.fn().mockResolvedValue('OK');
const mockRedisDel = vi.fn().mockResolvedValue(1);
vi.mock('app/services/cache/cacheService.js', async () => {
  const actual = await vi.importActual<
    typeof import('app/services/cache/cacheService.js')
  >('app/services/cache/cacheService.js');
  return {
    ...actual,
    getRedis: () => ({ set: mockRedisSet, del: mockRedisDel }),
  };
});

const userId = uuid(0);
const tripId = uuid(1);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: userId,
      email: 'user@example.com',
      first_name: 'Test',
      last_name: 'User',
      created_at: new Date('2025-01-01'),
      updated_at: null,
    };
    next();
  });
  app.post('/trips/:id/chat', chatHandlers.chat);
  app.use(errorHandler);
  return app;
}

function stubRepos(convId: string) {
  vi.mocked(tripRepo.getTripWithDetails).mockResolvedValue({
    id: tripId,
    user_id: userId,
    destination: 'Barcelona',
    origin: 'JFK',
    departure_date: '2026-07-01',
    return_date: '2026-07-06',
    budget_total: 3000,
    budget_currency: 'USD',
    travelers: 2,
    flights: [],
    hotels: [],
    experiences: [],
  } as never);
  vi.mocked(convRepo.getOrCreateConversation).mockResolvedValue({
    id: convId,
    trip_id: tripId,
  } as never);
  vi.mocked(convRepo.getMessagesByConversation).mockResolvedValue([]);
  vi.mocked(convRepo.insertMessage).mockResolvedValue({
    id: uuid(99),
    conversation_id: convId,
    role: 'user',
    content: 'Plan my trip',
    sequence: 1,
    created_at: '2026-01-01T00:00:00Z',
  } as never);
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    await new Promise((r) => setImmediate(r));
  }
}

describe('chat handler conversation lock (ENG-02)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRedisSet.mockResolvedValue('OK');
    mockRedisDel.mockResolvedValue(1);
  });

  it('exports getActiveConversationCount for observability', () => {
    expect(typeof chatHandlers.getActiveConversationCount).toBe('function');
  });

  it('rejects a second concurrent request to the same conversation with 409', async () => {
    const app = createApp();
    const convId = uuid(100);
    stubRepos(convId);

    // Deferred promise so the first agent loop hangs until we release it.
    let releaseFirst: (value: never) => void = () => {};
    vi.mocked(agentService.runAgentLoop).mockImplementationOnce(
      () =>
        new Promise<never>((resolve) => {
          releaseFirst = resolve;
        }),
    );

    // Fire the first request without awaiting; it will hang in
    // runAgentLoop with the lock held. The .end callback is a no-op so
    // supertest does not throw on the open connection.
    const firstHandle = request(app)
      .post(`/trips/${tripId}/chat`)
      .send({ message: 'first' })
      .end(() => {});

    // Wait until the chat handler has acquired the lock.
    await waitFor(() => chatHandlers.getActiveConversationCount() === 1);

    const second = await request(app)
      .post(`/trips/${tripId}/chat`)
      .send({ message: 'second to same conversation' });

    expect(second.status).toBe(409);
    expect(chatHandlers.getActiveConversationCount()).toBe(1);

    // Release the first loop so the lock is freed for subsequent tests.
    releaseFirst({
      response: 'done',
      tool_calls: [],
      total_tokens: {
        input: 0,
        output: 0,
        cache_creation: 0,
        cache_read: 0,
      },
      nodes: [{ type: 'text', content: 'done' }],
    } as never);

    await waitFor(() => chatHandlers.getActiveConversationCount() === 0);
    firstHandle.abort();
  });

  it('releases the lock after a successful run so the next request succeeds', async () => {
    const app = createApp();
    const convId = uuid(101);
    stubRepos(convId);

    vi.mocked(agentService.runAgentLoop).mockResolvedValue({
      response: 'done',
      tool_calls: [],
      total_tokens: {
        input: 0,
        output: 0,
        cache_creation: 0,
        cache_read: 0,
      },
      nodes: [{ type: 'text', content: 'done' }],
    } as never);

    const first = await request(app)
      .post(`/trips/${tripId}/chat`)
      .send({ message: 'first' });
    expect(first.status).toBe(200);

    await waitFor(() => chatHandlers.getActiveConversationCount() === 0);

    const second = await request(app)
      .post(`/trips/${tripId}/chat`)
      .send({ message: 'second' });
    expect(second.status).toBe(200);
  });

  it('acquires + releases the Redis lock around the agent loop (P2-01)', async () => {
    const app = createApp();
    const convId = uuid(102);
    stubRepos(convId);
    mockRedisSet.mockClear();
    mockRedisDel.mockClear();

    vi.mocked(agentService.runAgentLoop).mockResolvedValue({
      response: 'done',
      tool_calls: [],
      total_tokens: {
        input: 0,
        output: 0,
        cache_creation: 0,
        cache_read: 0,
      },
      nodes: [{ type: 'text', content: 'done' }],
    } as never);

    const res = await request(app)
      .post(`/trips/${tripId}/chat`)
      .send({ message: 'first' });
    expect(res.status).toBe(200);

    expect(mockRedisSet).toHaveBeenCalledWith(
      `conversation:lock:${convId}`,
      '1',
      'EX',
      180,
      'NX',
    );
    expect(mockRedisDel).toHaveBeenCalledWith(`conversation:lock:${convId}`);
  });

  it('returns 409 when Redis says the lock is already held by another replica (P2-01)', async () => {
    const app = createApp();
    const convId = uuid(103);
    stubRepos(convId);
    mockRedisSet.mockClear();
    // Simulate another replica already holding the lock: SET NX returns null.
    mockRedisSet.mockResolvedValueOnce(null);

    const res = await request(app)
      .post(`/trips/${tripId}/chat`)
      .send({ message: 'first' });

    expect(res.status).toBe(409);
    expect(chatHandlers.getActiveConversationCount()).toBe(0);
  });
});
