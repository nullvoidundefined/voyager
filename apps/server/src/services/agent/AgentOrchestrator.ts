/**
 * Drives the multi-turn agent loop: repeatedly calls the LLM, executes any
 * requested tool calls, and feeds results back until the model stops or the
 * per-message iteration cap (DEFAULT_MAX_ITERATIONS) is hit. The cap exists to
 * bound worst-case token burn per user message until cost is persisted.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { ChatNode, SSEEvent } from '@voyager/shared-types';

import { getLlmClient } from 'app/clients/llm.js';
import { logger } from 'app/clients/logger.js';
import { DEFAULT_MAX_TOKENS, DEFAULT_MODEL } from 'app/constants/models.js';

import { buildNodeFromToolResult } from './nodeBuilder.js';

// Lowered from 15 to 8 per FIN-06 (2026-04-06 audit). The original cap
// predates any cost observability. Until per-turn token cost is persisted
// in tool_call_log (FIN-04), a conservative 8 is the right safety limit:
// it still covers the typical 3 to 6 real agent turns while bounding
// worst-case burn per user message.
const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_MAX_DURATION_MS = 120_000;

export interface ToolCallRecord {
  tool_name: string;
  tool_id: string;
  input: Record<string, unknown>;
  result: unknown;
}

export interface FormatResponseData {
  text: string;
  citations?: unknown[];
  quick_replies?: string[];
  advisory?: {
    severity: 'info' | 'warning' | 'critical';
    title: string;
    body: string;
  };
  skip_category?: boolean;
  plan_card?: unknown;
}

export interface OrchestratorResult {
  response: string;
  toolCallsUsed: ToolCallRecord[];
  tokensUsed: {
    input: number;
    output: number;
    cache_creation: number;
    cache_read: number;
  };
  iterations: number;
  nodes: ChatNode[];
  formatResponse: FormatResponseData | null;
}

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
  /** Maximum wall-clock duration for the entire agent loop in milliseconds (default: 120s) */
  maxDurationMs?: number;
  model?: string;
  maxTokens?: number;
  /** Called after each tool execution for logging/observability */
  onToolExecuted?: OnToolExecuted;
  /** Provide a custom Anthropic client (useful for testing) */
  client?: Anthropic;
  /** Tools that must be called before format_response is accepted.
   *  Enforces the data-before-response invariant in code, not just prompts.
   *  When format_response is called before all required tools have run, the
   *  orchestrator returns a guardrail message and the agent must search first. */
  requiredBeforeFormat?: string[];
}

export class AgentOrchestrator {
  private readonly tools: Anthropic.Tool[];
  private readonly systemPromptBuilder: (...args: unknown[]) => string;
  private readonly toolExecutor: ToolExecutor;
  private readonly maxIterations: number;
  private readonly maxDurationMs: number;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly onToolExecuted?: OnToolExecuted;
  private readonly client: Anthropic;
  private readonly requiredBeforeFormat: string[];

  constructor(config: AgentOrchestratorConfig) {
    this.tools = config.tools;
    this.systemPromptBuilder = config.systemPromptBuilder;
    this.toolExecutor = config.toolExecutor;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.maxDurationMs = config.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.onToolExecuted = config.onToolExecuted;
    this.client = config.client ?? getLlmClient();
    this.requiredBeforeFormat = config.requiredBeforeFormat ?? [];
  }

  private buildFormatResponseGuardMessage(
    calledTools: ToolCallRecord[],
  ): string | null {
    if (this.requiredBeforeFormat.length === 0) return null;
    const missing = this.requiredBeforeFormat.filter(
      (name) => !calledTools.some((c) => c.tool_name === name),
    );
    if (missing.length === 0) return null;
    return `Guardrail: you must call ${missing.join(', ')} before format_response to show real results. Call it now, then present the results via format_response.`;
  }

  async run(
    messages: Anthropic.MessageParam[],
    systemPromptArgs: unknown[],
    onEvent?: (event: SSEEvent) => void,
    meta?: Record<string, unknown>,
  ): Promise<OrchestratorResult> {
    const systemPrompt = this.systemPromptBuilder(...systemPromptArgs);
    const toolCalls: ToolCallRecord[] = [];
    const tokensUsed = {
      input: 0,
      output: 0,
      cache_creation: 0,
      cache_read: 0,
    };
    let iterations = 0;

    // Mark the last tool with a cache breakpoint so the system prompt +
    // tools block is cached across all iterations of this agent loop turn.
    const toolsWithCache: Anthropic.Tool[] = this.tools.map((t, i) =>
      i === this.tools.length - 1
        ? { ...t, cache_control: { type: 'ephemeral' } as const }
        : t,
    );
    const collectedNodes: ChatNode[] = [];
    let formatResponseData: FormatResponseData | null = null;

    const conversationMessages = [...messages];
    const loopStartTime = Date.now();

    while (true) {
      // Wall-clock timeout: abort if the loop has been running too long
      const elapsed = Date.now() - loopStartTime;
      if (elapsed > this.maxDurationMs) {
        logger.warn(
          { iterations, tokensUsed, elapsed },
          'Agent loop timed out',
        );
        return {
          response:
            "I'm taking too long on this request. Please send another message to continue where I left off.",
          toolCallsUsed: toolCalls,
          tokensUsed,
          iterations,
          nodes: collectedNodes,
          formatResponse: formatResponseData,
        };
      }

      iterations++;

      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: toolsWithCache,
        messages: conversationMessages,
      });

      // Emit text tokens as they arrive (real-time typing animation)
      stream.on('text', (text) => {
        if (!formatResponseData) {
          onEvent?.({ type: 'text_delta', content: text });
        }
      });

      // Wait for the complete response
      const response = await stream.finalMessage();

      tokensUsed.input += response.usage.input_tokens;
      tokensUsed.output += response.usage.output_tokens;
      tokensUsed.cache_creation +=
        response.usage.cache_creation_input_tokens ?? 0;
      tokensUsed.cache_read += response.usage.cache_read_input_tokens ?? 0;

      // Surface running token spend after every iteration so the client can
      // show live budget burn instead of only a post-turn total.
      onEvent?.({
        type: 'budget',
        cache_creation_tokens: tokensUsed.cache_creation,
        cache_read_tokens: tokensUsed.cache_read,
        input_tokens: tokensUsed.input,
        output_tokens: tokensUsed.output,
      });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        );
        const text = textBlock?.text ?? '';
        // Text was already emitted token-by-token via stream.on('text', ...)
        return {
          response: text,
          toolCallsUsed: toolCalls,
          tokensUsed,
          iterations,
          nodes: collectedNodes,
          formatResponse: formatResponseData,
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
            nodes: collectedNodes,
            formatResponse: formatResponseData,
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
            type: 'tool_progress',
            tool_name: block.name,
            tool_id: block.id,
            status: 'running',
          });

          let result: unknown;
          let isError = false;
          let errorMessage: string | null = null;

          const guardMessage =
            block.name === 'format_response'
              ? this.buildFormatResponseGuardMessage(toolCalls)
              : null;

          const startTime = Date.now();
          if (guardMessage !== null) {
            result = guardMessage;
          } else {
            try {
              result = await this.toolExecutor(block.name, input, meta);
            } catch (err) {
              isError = true;
              errorMessage = err instanceof Error ? err.message : String(err);
              result = `Tool error (do not retry): ${errorMessage}`;
              logger.error(
                { err, toolName: block.name },
                'Tool execution failed',
              );
            }
          }
          const latencyMs = Date.now() - startTime;

          const record: ToolCallRecord = {
            tool_name: block.name,
            tool_id: block.id,
            input,
            result,
          };
          toolCalls.push(record);

          // Build a typed node from the tool result
          const node = buildNodeFromToolResult(block.name, result);
          if (node) {
            collectedNodes.push(node);
            onEvent?.({ type: 'node', node });
          }

          // Record format_response data only when the guard passed (required search was done)
          if (block.name === 'format_response' && guardMessage === null) {
            formatResponseData = result as FormatResponseData;
          }

          onEvent?.({
            type: 'tool_progress',
            tool_name: block.name,
            tool_id: block.id,
            status: 'done',
          });

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
      } else {
        // Unexpected stop_reason (e.g. 'max_tokens'). Break the loop
        // to avoid burning API calls for the remaining timeout window.
        logger.warn(
          { stop_reason: response.stop_reason, iterations, tokensUsed },
          'Agent loop terminated on unexpected stop_reason',
        );
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        );
        return {
          response:
            textBlock?.text ||
            `The response was cut short (${response.stop_reason}). Please send another message to continue.`,
          toolCallsUsed: toolCalls,
          tokensUsed,
          iterations,
          nodes: collectedNodes,
          formatResponse: formatResponseData,
        };
      }
    }
  }
}
