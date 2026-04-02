import Anthropic from '@anthropic-ai/sdk';
import { logger } from 'app/utils/logs/logger.js';

const DEFAULT_MAX_ITERATIONS = 15;
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;

export interface ToolCallRecord {
  tool_name: string;
  tool_id: string;
  input: Record<string, unknown>;
  result: unknown;
}

export interface OrchestratorResult {
  response: string;
  toolCallsUsed: ToolCallRecord[];
  tokensUsed: { input: number; output: number };
  iterations: number;
}

export type ProgressEvent =
  | {
      type: 'tool_start';
      tool_name: string;
      tool_id: string;
      input: Record<string, unknown>;
    }
  | { type: 'tool_result'; tool_id: string; result: unknown }
  | { type: 'assistant'; text: string };

export type ToolExecutor = (
  toolName: string,
  input: Record<string, unknown>,
  meta?: Record<string, unknown>,
) => Promise<unknown>;

export type OnToolExecuted = (record: {
  tool_name: string;
  tool_id: string;
  input: Record<string, unknown>;
  result: unknown;
  isError: boolean;
  errorMessage: string | null;
  latencyMs: number;
}) => void;

export interface AgentOrchestratorConfig {
  tools: Anthropic.Tool[];
  systemPromptBuilder: (...args: unknown[]) => string;
  toolExecutor: ToolExecutor;
  maxIterations?: number;
  model?: string;
  maxTokens?: number;
  /** Called after each tool execution for logging/observability */
  onToolExecuted?: OnToolExecuted;
  /** Provide a custom Anthropic client (useful for testing) */
  client?: Anthropic;
}

export class AgentOrchestrator {
  private readonly tools: Anthropic.Tool[];
  private readonly systemPromptBuilder: (...args: unknown[]) => string;
  private readonly toolExecutor: ToolExecutor;
  private readonly maxIterations: number;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly onToolExecuted?: OnToolExecuted;
  private readonly client: Anthropic;

  constructor(config: AgentOrchestratorConfig) {
    this.tools = config.tools;
    this.systemPromptBuilder = config.systemPromptBuilder;
    this.toolExecutor = config.toolExecutor;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.onToolExecuted = config.onToolExecuted;
    this.client = config.client ?? new Anthropic();
  }

  async run(
    messages: Anthropic.MessageParam[],
    systemPromptArgs: unknown[],
    onEvent?: (event: ProgressEvent) => void,
    meta?: Record<string, unknown>,
  ): Promise<OrchestratorResult> {
    const systemPrompt = this.systemPromptBuilder(...systemPromptArgs);
    const toolCalls: ToolCallRecord[] = [];
    const tokensUsed = { input: 0, output: 0 };
    let iterations = 0;

    const conversationMessages = [...messages];

    while (true) {
      iterations++;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        tools: this.tools,
        messages: conversationMessages,
      });

      tokensUsed.input += response.usage.input_tokens;
      tokensUsed.output += response.usage.output_tokens;

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        );
        const text = textBlock?.text ?? '';
        onEvent?.({ type: 'assistant', text });
        return {
          response: text,
          toolCallsUsed: toolCalls,
          tokensUsed,
          iterations,
        };
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        );

        // Check tool call limit before executing
        if (toolCalls.length + toolUseBlocks.length > this.maxIterations) {
          return {
            response:
              "I've reached the tool call limit for this turn. Please send another message to continue.",
            toolCallsUsed: toolCalls,
            tokensUsed,
            iterations,
          };
        }

        // Add assistant message with tool use blocks
        conversationMessages.push({
          role: 'assistant',
          content: response.content,
        });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          const input = block.input as Record<string, unknown>;
          onEvent?.({
            type: 'tool_start',
            tool_name: block.name,
            tool_id: block.id,
            input,
          });

          let result: unknown;
          let isError = false;
          let errorMessage: string | null = null;

          const startTime = Date.now();
          try {
            result = await this.toolExecutor(block.name, input, meta);
          } catch (err) {
            isError = true;
            errorMessage = err instanceof Error ? err.message : String(err);
            result = `Error: ${errorMessage}`;
            logger.error(
              { err, toolName: block.name },
              'Tool execution failed',
            );
          }
          const latencyMs = Date.now() - startTime;

          const record: ToolCallRecord = {
            tool_name: block.name,
            tool_id: block.id,
            input,
            result,
          };
          toolCalls.push(record);

          onEvent?.({ type: 'tool_result', tool_id: block.id, result });

          this.onToolExecuted?.({
            ...record,
            isError,
            errorMessage,
            latencyMs,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content:
              typeof result === 'string' ? result : JSON.stringify(result),
            ...(isError && { is_error: true }),
          });
        }

        conversationMessages.push({ role: 'user', content: toolResults });
      }
    }
  }
}
