import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AgentOrchestrator,
  type AgentOrchestratorConfig,
  type ProgressEvent,
} from './AgentOrchestrator.js';

// ---------------------------------------------------------------------------
// Mock the logger so we don't pollute test output
// ---------------------------------------------------------------------------
vi.mock('app/utils/logs/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers to build Anthropic-shaped responses
// ---------------------------------------------------------------------------
function makeTextResponse(text: string, inputTokens = 10, outputTokens = 20) {
  return {
    content: [{ type: 'text' as const, text }],
    stop_reason: 'end_turn' as const,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

function makeToolUseResponse(
  tools: { id: string; name: string; input: Record<string, unknown> }[],
  inputTokens = 15,
  outputTokens = 25,
) {
  return {
    content: tools.map((t) => ({
      type: 'tool_use' as const,
      id: t.id,
      name: t.name,
      input: t.input,
    })),
    stop_reason: 'tool_use' as const,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

// ---------------------------------------------------------------------------
// Default orchestrator config factory
// ---------------------------------------------------------------------------
function createConfig(
  overrides?: Partial<AgentOrchestratorConfig>,
): AgentOrchestratorConfig {
  const mockCreate = vi.fn();
  const mockClient = { messages: { create: mockCreate } } as never;

  return {
    tools: [
      {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          type: 'object' as const,
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ],
    systemPromptBuilder: (...args: unknown[]) =>
      `System prompt for ${JSON.stringify(args)}`,
    toolExecutor: vi.fn().mockResolvedValue({ result: 'ok' }),
    client: mockClient,
    ...overrides,
  };
}

function getCreateMock(config: AgentOrchestratorConfig): Mock {
  return (config.client as unknown as { messages: { create: Mock } }).messages
    .create;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AgentOrchestrator', () => {
  let config: AgentOrchestratorConfig;
  let createMock: Mock;

  beforeEach(() => {
    vi.restoreAllMocks();
    config = createConfig();
    createMock = getCreateMock(config);
  });

  // -----------------------------------------------------------------------
  // stop_reason: end_turn — returns text immediately
  // -----------------------------------------------------------------------
  it('returns the assistant response on end_turn', async () => {
    createMock.mockResolvedValueOnce(makeTextResponse('Hello traveler!'));

    const orchestrator = new AgentOrchestrator(config);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Hi' }],
      ['ctx'],
    );

    expect(result.response).toBe('Hello traveler!');
    expect(result.toolCallsUsed).toHaveLength(0);
    expect(result.iterations).toBe(1);
    expect(result.tokensUsed).toEqual({ input: 10, output: 20 });
  });

  // -----------------------------------------------------------------------
  // Tool call execution — tools called with correct input
  // -----------------------------------------------------------------------
  it('executes tool calls and returns final response', async () => {
    const toolInput = { query: 'flights to paris' };
    createMock
      .mockResolvedValueOnce(
        makeToolUseResponse([
          { id: 'tool_1', name: 'test_tool', input: toolInput },
        ]),
      )
      .mockResolvedValueOnce(makeTextResponse('Found flights for you!'));

    const orchestrator = new AgentOrchestrator(config);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Find flights' }],
      [],
    );

    expect(config.toolExecutor).toHaveBeenCalledWith(
      'test_tool',
      toolInput,
      undefined,
    );
    expect(result.toolCallsUsed).toHaveLength(1);
    expect(result.toolCallsUsed[0]!.tool_name).toBe('test_tool');
    expect(result.toolCallsUsed[0]!.input).toEqual(toolInput);
    expect(result.response).toBe('Found flights for you!');
    expect(result.iterations).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Meta is passed to tool executor
  // -----------------------------------------------------------------------
  it('passes meta to the tool executor', async () => {
    createMock
      .mockResolvedValueOnce(
        makeToolUseResponse([
          { id: 'tool_1', name: 'test_tool', input: { query: 'x' } },
        ]),
      )
      .mockResolvedValueOnce(makeTextResponse('Done'));

    const orchestrator = new AgentOrchestrator(config);
    await orchestrator.run([{ role: 'user', content: 'Go' }], [], undefined, {
      tripId: 'trip_123',
      userId: 'user_456',
    });

    expect(config.toolExecutor).toHaveBeenCalledWith(
      'test_tool',
      { query: 'x' },
      { tripId: 'trip_123', userId: 'user_456' },
    );
  });

  // -----------------------------------------------------------------------
  // Max iteration enforcement
  // -----------------------------------------------------------------------
  it('stops after reaching the max tool call limit', async () => {
    const orchestratorConfig = createConfig({ maxIterations: 2 });
    const mockCreate = getCreateMock(orchestratorConfig);

    // First call: 1 tool use
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        { id: 'tool_1', name: 'test_tool', input: { query: 'a' } },
      ]),
    );
    // Second call: 2 more tool uses — would push total to 3 > limit of 2
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        { id: 'tool_2', name: 'test_tool', input: { query: 'b' } },
        { id: 'tool_3', name: 'test_tool', input: { query: 'c' } },
      ]),
    );

    const orchestrator = new AgentOrchestrator(orchestratorConfig);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Go' }],
      [],
    );

    expect(result.response).toContain('tool call limit');
    expect(result.toolCallsUsed).toHaveLength(1); // only the first batch executed
    expect(result.iterations).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Error during tool execution — continues gracefully
  // -----------------------------------------------------------------------
  it('handles tool execution errors gracefully', async () => {
    const failingExecutor = vi
      .fn()
      .mockRejectedValueOnce(new Error('API timeout'));

    const errorConfig = createConfig({ toolExecutor: failingExecutor });
    const mockCreate = getCreateMock(errorConfig);

    mockCreate
      .mockResolvedValueOnce(
        makeToolUseResponse([
          { id: 'tool_1', name: 'test_tool', input: { query: 'x' } },
        ]),
      )
      .mockResolvedValueOnce(makeTextResponse('Sorry, the search failed.'));

    const orchestrator = new AgentOrchestrator(errorConfig);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Search' }],
      [],
    );

    expect(result.toolCallsUsed).toHaveLength(1);
    expect(result.toolCallsUsed[0]!.result).toBe('Error: API timeout');
    expect(result.response).toBe('Sorry, the search failed.');

    // Verify the second call to Anthropic included is_error in tool result
    const secondCallMessages = mockCreate.mock.calls[1]![0].messages;
    const lastUserMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(lastUserMsg.content[0].is_error).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Event emission — onEvent callback receives correct events
  // -----------------------------------------------------------------------
  it('emits events for tool_start, tool_result, and assistant', async () => {
    const events: ProgressEvent[] = [];
    const onEvent = (e: ProgressEvent) => events.push(e);

    createMock
      .mockResolvedValueOnce(
        makeToolUseResponse([
          {
            id: 'tool_1',
            name: 'test_tool',
            input: { query: 'paris' },
          },
        ]),
      )
      .mockResolvedValueOnce(makeTextResponse('Here are your results.'));

    const orchestrator = new AgentOrchestrator(config);
    await orchestrator.run([{ role: 'user', content: 'Search' }], [], onEvent);

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({
      type: 'tool_start',
      tool_name: 'test_tool',
      tool_id: 'tool_1',
      input: { query: 'paris' },
    });
    expect(events[1]).toEqual({
      type: 'tool_result',
      tool_id: 'tool_1',
      result: { result: 'ok' },
    });
    expect(events[2]).toEqual({
      type: 'assistant',
      text: 'Here are your results.',
    });
  });

  // -----------------------------------------------------------------------
  // onToolExecuted callback receives correct data
  // -----------------------------------------------------------------------
  it('calls onToolExecuted with tool execution details', async () => {
    const onToolExecuted = vi.fn();
    const toolConfig = createConfig({ onToolExecuted });
    const mockCreate = getCreateMock(toolConfig);

    mockCreate
      .mockResolvedValueOnce(
        makeToolUseResponse([
          { id: 'tool_1', name: 'test_tool', input: { query: 'x' } },
        ]),
      )
      .mockResolvedValueOnce(makeTextResponse('Done'));

    const orchestrator = new AgentOrchestrator(toolConfig);
    await orchestrator.run([{ role: 'user', content: 'Go' }], []);

    expect(onToolExecuted).toHaveBeenCalledOnce();
    const call = onToolExecuted.mock.calls[0]![0];
    expect(call.tool_name).toBe('test_tool');
    expect(call.tool_id).toBe('tool_1');
    expect(call.isError).toBe(false);
    expect(call.errorMessage).toBeNull();
    expect(call.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // -----------------------------------------------------------------------
  // Token accumulation across iterations
  // -----------------------------------------------------------------------
  it('accumulates tokens across multiple iterations', async () => {
    createMock
      .mockResolvedValueOnce(
        makeToolUseResponse(
          [{ id: 'tool_1', name: 'test_tool', input: { query: 'a' } }],
          100,
          50,
        ),
      )
      .mockResolvedValueOnce(makeTextResponse('Done', 200, 80));

    const orchestrator = new AgentOrchestrator(config);
    const result = await orchestrator.run(
      [{ role: 'user', content: 'Go' }],
      [],
    );

    expect(result.tokensUsed).toEqual({ input: 300, output: 130 });
  });

  // -----------------------------------------------------------------------
  // System prompt builder is called with correct args
  // -----------------------------------------------------------------------
  it('passes systemPromptArgs to the systemPromptBuilder', async () => {
    const builder = vi.fn().mockReturnValue('Built prompt');
    const builderConfig = createConfig({ systemPromptBuilder: builder });
    const mockCreate = getCreateMock(builderConfig);
    mockCreate.mockResolvedValueOnce(makeTextResponse('Hi'));

    const orchestrator = new AgentOrchestrator(builderConfig);
    await orchestrator.run(
      [{ role: 'user', content: 'Hello' }],
      [{ destination: 'Paris' }, 'extra'],
    );

    expect(builder).toHaveBeenCalledWith({ destination: 'Paris' }, 'extra');
    expect(mockCreate.mock.calls[0]![0].system).toBe('Built prompt');
  });
});
