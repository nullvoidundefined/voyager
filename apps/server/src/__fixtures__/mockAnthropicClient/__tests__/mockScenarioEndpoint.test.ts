/**
 * Integration test for the POST /api/test/mock-scenario endpoint.
 *
 * This endpoint is registered in app.ts behind two gates:
 *   1. NODE_ENV !== 'production' (route not registered)
 *   2. E2E_MOCK_ANTHROPIC === '1' (handler returns 404)
 *
 * Since importing app.ts has heavy side effects (DB pool, helmet,
 * session middleware, etc.), this test builds a minimal Express app
 * that replicates the endpoint logic exactly as written in app.ts.
 * The mockAnthropicClient module state is real (not mocked), so
 * this validates the full setMockScenario -> getMockScenario flow
 * through an HTTP interface.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type MockScenarioName,
  getMockScenario,
  isAnthropicMockMode,
  resetMockScenario,
  setMockScenario,
} from 'app/__fixtures__/mockAnthropicClient/mockAnthropicClient.js';

function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.post('/api/test/mock-scenario', (req, res) => {
    if (!isAnthropicMockMode()) {
      res.status(404).json({ error: 'Not available outside mock mode' });
      return;
    }
    const { scenario } = req.body as { scenario?: string };
    if (scenario !== 'default' && scenario !== 'selection') {
      res.status(400).json({
        error: 'Invalid scenario. Must be "default" or "selection".',
      });
      return;
    }
    setMockScenario(scenario as MockScenarioName);
    res.status(200).json({ scenario });
  });

  return app;
}

describe('POST /api/test/mock-scenario', () => {
  const ORIGINAL_MOCK = process.env.E2E_MOCK_ANTHROPIC;

  afterEach(() => {
    resetMockScenario();
    if (ORIGINAL_MOCK === undefined) {
      delete process.env.E2E_MOCK_ANTHROPIC;
    } else {
      process.env.E2E_MOCK_ANTHROPIC = ORIGINAL_MOCK;
    }
  });

  it('returns 404 when E2E_MOCK_ANTHROPIC is not set', async () => {
    delete process.env.E2E_MOCK_ANTHROPIC;
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/test/mock-scenario')
      .send({ scenario: 'selection' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/mock mode/i);
  });

  it('returns 404 when E2E_MOCK_ANTHROPIC is not "1"', async () => {
    process.env.E2E_MOCK_ANTHROPIC = 'true';
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/test/mock-scenario')
      .send({ scenario: 'selection' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid scenario name', async () => {
    process.env.E2E_MOCK_ANTHROPIC = '1';
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/test/mock-scenario')
      .send({ scenario: 'nonexistent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid scenario/i);
  });

  it('returns 400 when scenario is missing from body', async () => {
    process.env.E2E_MOCK_ANTHROPIC = '1';
    const app = buildTestApp();
    const res = await request(app).post('/api/test/mock-scenario').send({});

    expect(res.status).toBe(400);
  });

  it('sets scenario to "selection" and confirms via getMockScenario', async () => {
    process.env.E2E_MOCK_ANTHROPIC = '1';
    const app = buildTestApp();
    const res = await request(app)
      .post('/api/test/mock-scenario')
      .send({ scenario: 'selection' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ scenario: 'selection' });
    expect(getMockScenario()).toBe('selection');
  });

  it('sets scenario to "default" and confirms via getMockScenario', async () => {
    process.env.E2E_MOCK_ANTHROPIC = '1';
    setMockScenario('selection');

    const app = buildTestApp();
    const res = await request(app)
      .post('/api/test/mock-scenario')
      .send({ scenario: 'default' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ scenario: 'default' });
    expect(getMockScenario()).toBe('default');
  });

  it('switching scenario affects MockAnthropicClient behavior', async () => {
    process.env.E2E_MOCK_ANTHROPIC = '1';
    const app = buildTestApp();

    // Set selection scenario via HTTP
    await request(app)
      .post('/api/test/mock-scenario')
      .send({ scenario: 'selection' });

    // Verify the mock client now uses the selection script
    const { MockAnthropicClient } =
      await import('app/__fixtures__/mockAnthropicClient/mockAnthropicClient.js');
    const client = new MockAnthropicClient();
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'test',
      tools: [],
      messages: [
        { role: 'user', content: 'Plan a trip' },
        { role: 'assistant', content: [] },
        { role: 'user', content: [] },
        { role: 'assistant', content: [] },
        { role: 'user', content: "I'll take the cheapest flight" },
      ],
    });

    const final = await stream.finalMessage();
    expect(final.stop_reason).toBe('tool_use');
    const block = final.content[0];
    if (block?.type !== 'tool_use') {
      throw new Error('expected tool_use');
    }
    expect(block.name).toBe('format_response');
    const input = block.input as { text: string };
    expect(input.text).toContain('booking');
  });
});
