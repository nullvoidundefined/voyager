/**
 * Fixture-replay tests for the agent loop (R-200).
 *
 * R-200 mandates that every LLM consumer includes one fixture test
 * against a real captured response. The fixtures under
 * test-fixtures/mockAnthropicClient/__fixtures__/ are the canonical
 * captured shapes. This spec replays them through runAgentLoop and
 * asserts the exact tool-call sequence, so a prompt change that
 * causes the mock to script a different iteration order will be
 * caught here before reaching production.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    {
      name: 'format_response',
      description: 'Format response',
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

const FIXTURES_DIR = join(
  import.meta.dirname,
  '../../../test-fixtures/mockAnthropicClient/__fixtures__',
);

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8'));
}

function buildStreamFromFixture(fixture: Record<string, unknown>) {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  return {
    on(event: string, cb: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      return this;
    },
    async finalMessage() {
      const content = fixture.content as
        | Array<{ type: string; text?: string }>
        | undefined;
      const textBlock = content?.find((b) => b.type === 'text');
      if (textBlock?.text && listeners['text']) {
        for (const char of textBlock.text) {
          for (const cb of listeners['text']) cb(char);
        }
      }
      return fixture;
    },
  };
}

describe('agentService fixture replay', () => {
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

  it('iteration-1 fixture: fires search_flights then search_hotels', async () => {
    const iteration1 = loadFixture('iteration-1-tool-use.json');
    const iteration3 = loadFixture('iteration-3-end-turn.json');

    // Iteration 1: tool use (search_flights + search_hotels)
    mockStream.mockReturnValueOnce(buildStreamFromFixture(iteration1));
    // Both tools return mock results
    vi.mocked(executeTool)
      .mockResolvedValueOnce([{ price: 350, airline: 'UA' }])
      .mockResolvedValueOnce([{ name: 'Hotel X', price_per_night: 120 }]);
    // Final turn: end_turn
    mockStream.mockReturnValueOnce(buildStreamFromFixture(iteration3));

    const result = await runAgentLoop(
      [{ role: 'user', content: 'Plan a trip to San Francisco' }],
      undefined,
      () => {},
    );

    // Iteration 1 fixture hardcodes search_flights and search_hotels as the
    // two tool calls. Assert the names in order.
    expect(result.tool_calls).toHaveLength(2);
    expect(result.tool_calls[0]!.tool_name).toBe('search_flights');
    expect(result.tool_calls[1]!.tool_name).toBe('search_hotels');
  });

  it('iteration-1 fixture: tool inputs match the captured fixture values', async () => {
    const iteration1 = loadFixture('iteration-1-tool-use.json');
    const iteration3 = loadFixture('iteration-3-end-turn.json');

    mockStream.mockReturnValueOnce(buildStreamFromFixture(iteration1));
    vi.mocked(executeTool).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockStream.mockReturnValueOnce(buildStreamFromFixture(iteration3));

    const capturedContent = iteration1.content as Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
    const flightInput = capturedContent.find(
      (b) => b.type === 'tool_use' && b.name === 'search_flights',
    )?.input;
    const hotelInput = capturedContent.find(
      (b) => b.type === 'tool_use' && b.name === 'search_hotels',
    )?.input;

    await runAgentLoop(
      [{ role: 'user', content: 'Plan a trip' }],
      undefined,
      () => {},
    );

    // The executor must be called with exactly the inputs from the fixture.
    const flightCall = vi
      .mocked(executeTool)
      .mock.calls.find((c) => c[0] === 'search_flights');
    const hotelCall = vi
      .mocked(executeTool)
      .mock.calls.find((c) => c[0] === 'search_hotels');

    expect(flightCall?.[1]).toEqual(flightInput);
    expect(hotelCall?.[1]).toEqual(hotelInput);
  });

  it('iteration-2 fixture: calls format_response with text and quick_replies', async () => {
    const iteration1 = loadFixture('iteration-1-tool-use.json');
    const iteration2 = loadFixture('iteration-2-format-response.json');
    const iteration3 = loadFixture('iteration-3-end-turn.json');

    // Iteration 1: search tools
    mockStream.mockReturnValueOnce(buildStreamFromFixture(iteration1));
    vi.mocked(executeTool)
      .mockResolvedValueOnce([{ price: 350 }])
      .mockResolvedValueOnce([{ name: 'Hotel' }]);

    // Iteration 2: format_response
    mockStream.mockReturnValueOnce(buildStreamFromFixture(iteration2));
    const formatFixture = loadFixture('iteration-2-format-response.json')
      .content as Array<{ type: string; input?: Record<string, unknown> }>;
    const formatInput = formatFixture.find((b) => b.type === 'tool_use')?.input;
    vi.mocked(executeTool).mockResolvedValueOnce(formatInput ?? {});

    // Iteration 3: end_turn
    mockStream.mockReturnValueOnce(buildStreamFromFixture(iteration3));

    const result = await runAgentLoop(
      [{ role: 'user', content: 'Plan a trip to San Francisco' }],
      undefined,
      () => {},
    );

    // format_response is the third tool call in the full run.
    const formatCall = result.tool_calls.find(
      (c) => c.tool_name === 'format_response',
    );
    expect(formatCall).toBeDefined();

    // The quick_replies node should appear in the result.
    const chipsNode = result.nodes.find((n) => n.type === 'quick_replies');
    expect(chipsNode).toBeDefined();
  });

  it('iteration-3 fixture: loop terminates on end_turn and emits response text', async () => {
    const iteration3 = loadFixture('iteration-3-end-turn.json');
    mockStream.mockReturnValueOnce(buildStreamFromFixture(iteration3));

    const result = await runAgentLoop(
      [{ role: 'user', content: 'Confirm' }],
      undefined,
      () => {},
    );

    const expectedText = (
      (iteration3.content as Array<{ type: string; text?: string }>).find(
        (b) => b.type === 'text',
      ) ?? {}
    ).text;

    expect(result.response).toBe(expectedText);
    expect(result.tool_calls).toHaveLength(0);
  });

  it('full 3-iteration replay: tool call count and stream call count match fixtures', async () => {
    const iteration1 = loadFixture('iteration-1-tool-use.json');
    const iteration2 = loadFixture('iteration-2-format-response.json');
    const iteration3 = loadFixture('iteration-3-end-turn.json');

    mockStream
      .mockReturnValueOnce(buildStreamFromFixture(iteration1))
      .mockReturnValueOnce(buildStreamFromFixture(iteration2))
      .mockReturnValueOnce(buildStreamFromFixture(iteration3));

    // 2 search tools from iter 1, 1 format_response from iter 2
    vi.mocked(executeTool)
      .mockResolvedValueOnce([{ price: 350 }])
      .mockResolvedValueOnce([{ name: 'Hotel' }])
      .mockResolvedValueOnce({ text: 'Done', quick_replies: ['Option A'] });

    const result = await runAgentLoop(
      [{ role: 'user', content: 'Plan a trip to San Francisco from Denver' }],
      undefined,
      () => {},
    );

    // 3 Anthropic calls (one per iteration)
    expect(mockStream).toHaveBeenCalledTimes(3);
    // 3 tool calls total: search_flights, search_hotels, format_response
    expect(result.tool_calls).toHaveLength(3);
    expect(result.tool_calls.map((c) => c.tool_name)).toEqual([
      'search_flights',
      'search_hotels',
      'format_response',
    ]);
  });
});
