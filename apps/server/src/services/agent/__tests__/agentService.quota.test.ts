/**
 * Quota-exhaustion degradation tests for the agent loop.
 *
 * The SerpApi free tier allows 250 searches/month. When the cap is
 * reached, flightsTool and hotelsTool return a structured
 * { status: 'quota_exhausted', ... } result instead of throwing.
 * This result flows back to Claude as a tool result; Claude should
 * respond gracefully rather than triggering an error cascade.
 *
 * Gap tested here: the tool-level quota tests in flightsTool.test.ts
 * and hotelsTool.test.ts verify the structured return shape. This
 * spec verifies the layer above: that runAgentLoop processes a
 * quota_exhausted tool result as a normal turn (no crash, no error
 * event, no empty response).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SSEEvent } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { insertToolCallLog } from 'app/repositories/tool-call-log.js';
import { executeTool } from 'app/tools/executor.js';

import { runAgentLoop } from '../agentService.js';

vi.mock('@anthropic-ai/sdk');
vi.mock('app/tools/executor.js');
vi.mock('app/tools/mock/isMockMode.js', () => ({
  isMockMode: vi.fn().mockReturnValue(false),
}));
vi.mock('app/tools/mock/flightsMock.js', () => ({
  generateMockFlights: vi.fn(),
}));
vi.mock('app/tools/mock/hotelsMock.js', () => ({
  generateMockHotels: vi.fn(),
}));
vi.mock('app/tools/mock/carRentalsMock.js', () => ({
  generateMockCarRentals: vi.fn(),
}));
vi.mock('app/tools/mock/experiencesMock.js', () => ({
  generateMockExperiences: vi.fn(),
}));
vi.mock('app/tools/definitions.js', () => ({
  TOOL_DEFINITIONS: [
    {
      name: 'search_flights',
      description: 'Search flights',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'search_hotels',
      description: 'Search hotels',
      input_schema: { type: 'object', properties: {}, required: [] },
    },
  ],
}));
vi.mock('app/prompts/systemPrompt.js', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('You are a travel planner.'),
}));
vi.mock('app/clients/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('app/repositories/tool-call-log.js', () => ({
  insertToolCallLog: vi.fn().mockResolvedValue({}),
}));

const QUOTA_EXHAUSTED_FLIGHTS = {
  status: 'quota_exhausted' as const,
  flights: [],
  message:
    'Flight search is temporarily unavailable: the monthly SerpApi quota for this demo has been reached. Try again next month or skip flights for now.',
};

const QUOTA_EXHAUSTED_HOTELS = {
  status: 'quota_exhausted' as const,
  hotels: [],
  message:
    'Hotel search is temporarily unavailable: the monthly SerpApi quota for this demo has been reached. Try again next month or skip hotels for now.',
};

function buildStream(response: Record<string, unknown>) {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  return {
    on(event: string, cb: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      return this;
    },
    async finalMessage() {
      const content = response.content as
        | Array<{ type: string; text?: string }>
        | undefined;
      const textBlock = content?.find((b) => b.type === 'text');
      if (textBlock?.text && listeners['text']) {
        for (const char of textBlock.text) {
          for (const cb of listeners['text']) cb(char);
        }
      }
      return response;
    },
  };
}

describe('agentService quota exhaustion degradation', () => {
  let mockStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(insertToolCallLog).mockResolvedValue({} as never);
    process.env.ANTHROPIC_API_KEY = 'test-key';

    mockStream = vi.fn();
    vi.mocked(Anthropic).mockImplementation(
      () =>
        ({
          messages: { stream: mockStream },
        }) as unknown as Anthropic,
    );
  });

  it('completes cleanly when search_flights returns quota_exhausted', async () => {
    mockStream.mockReturnValueOnce(
      buildStream({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_quota_1',
            name: 'search_flights',
            input: {
              origin: 'JFK',
              destination: 'LIS',
              departure_date: '2026-07-01',
              passengers: 2,
            },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    );

    vi.mocked(executeTool).mockResolvedValueOnce(QUOTA_EXHAUSTED_FLIGHTS);

    mockStream.mockReturnValueOnce(
      buildStream({
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: "I wasn't able to search for flights right now because the monthly search quota has been reached. I can still help you plan the rest of your trip.",
          },
        ],
        usage: { input_tokens: 200, output_tokens: 60 },
      }),
    );

    const emittedEvents: SSEEvent[] = [];
    const result = await runAgentLoop(
      [{ role: 'user', content: 'Find flights to Lisbon' }],
      undefined,
      (event) => emittedEvents.push(event as SSEEvent),
    );

    expect(result.response).toBeTruthy();
    expect(result.response).toMatch(/quota|search|unavailable/i);
    expect(emittedEvents.filter((e) => e.type === 'error')).toHaveLength(0);
  });

  it('sends the quota_exhausted message back to Claude as the tool result', async () => {
    mockStream.mockReturnValueOnce(
      buildStream({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_quota_2',
            name: 'search_flights',
            input: {
              origin: 'JFK',
              destination: 'LIS',
              departure_date: '2026-07-01',
              passengers: 1,
            },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    );

    vi.mocked(executeTool).mockResolvedValueOnce(QUOTA_EXHAUSTED_FLIGHTS);

    mockStream.mockReturnValueOnce(
      buildStream({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Monthly quota reached.' }],
        usage: { input_tokens: 200, output_tokens: 20 },
      }),
    );

    await runAgentLoop(
      [{ role: 'user', content: 'Find flights' }],
      undefined,
      () => {},
    );

    // The second Anthropic call must include the tool result containing
    // the quota message so Claude can reason about it.
    const secondCallMessages = mockStream.mock.calls[1]?.[0]?.messages as
      | Array<{ role: string; content: unknown }>
      | undefined;
    expect(secondCallMessages).toBeDefined();

    const toolResultMsg = secondCallMessages?.find(
      (m) => m.role === 'user' && Array.isArray(m.content),
    );
    expect(toolResultMsg).toBeDefined();
    expect(JSON.stringify(toolResultMsg?.content ?? '')).toContain('quota');
  });

  it('records the tool call in the log even when quota is exhausted', async () => {
    mockStream.mockReturnValueOnce(
      buildStream({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_quota_3',
            name: 'search_flights',
            input: {
              origin: 'JFK',
              destination: 'LIS',
              departure_date: '2026-07-01',
              passengers: 1,
            },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    );

    vi.mocked(executeTool).mockResolvedValueOnce(QUOTA_EXHAUSTED_FLIGHTS);

    mockStream.mockReturnValueOnce(
      buildStream({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Quota reached.' }],
        usage: { input_tokens: 200, output_tokens: 20 },
      }),
    );

    await runAgentLoop(
      [{ role: 'user', content: 'Find flights' }],
      undefined,
      () => {},
      'conv-quota-test',
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(insertToolCallLog).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-quota-test',
        tool_name: 'search_flights',
      }),
    );
  });

  it('handles quota exhaustion for both flights and hotels in one turn', async () => {
    mockStream.mockReturnValueOnce(
      buildStream({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_q_flights',
            name: 'search_flights',
            input: {
              origin: 'JFK',
              destination: 'LIS',
              departure_date: '2026-07-01',
              passengers: 1,
            },
          },
          {
            type: 'tool_use',
            id: 'toolu_q_hotels',
            name: 'search_hotels',
            input: {
              city: 'Lisbon',
              check_in: '2026-07-01',
              check_out: '2026-07-04',
              guests: 1,
            },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 80 },
      }),
    );

    vi.mocked(executeTool)
      .mockResolvedValueOnce(QUOTA_EXHAUSTED_FLIGHTS)
      .mockResolvedValueOnce(QUOTA_EXHAUSTED_HOTELS);

    mockStream.mockReturnValueOnce(
      buildStream({
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: 'Search quota reached for both flights and hotels.',
          },
        ],
        usage: { input_tokens: 300, output_tokens: 40 },
      }),
    );

    const emittedEvents: SSEEvent[] = [];
    const result = await runAgentLoop(
      [{ role: 'user', content: 'Find flights and hotels' }],
      undefined,
      (event) => emittedEvents.push(event as SSEEvent),
    );

    expect(result.tool_calls).toHaveLength(2);
    expect(emittedEvents.filter((e) => e.type === 'error')).toHaveLength(0);
    expect(result.response).toBeTruthy();
  });
});
