import type Anthropic from '@anthropic-ai/sdk';
import type {
  ChatNode,
  Citation,
  SSEEvent,
  TripPlanCard,
} from '@voyager/shared-types';
import { logger } from 'app/clients/logger.js';
import {
  type CompletionTracker,
  type FlowPosition,
} from 'app/prompts/bookingSteps/bookingSteps.js';
import { buildSystemPrompt } from 'app/prompts/systemPrompt/systemPrompt.js';
import type { TripContext } from 'app/prompts/tripContext/tripContext.js';
import { insertAgentTurnCost } from 'app/repositories/agentTurnCost.js';
import { insertToolCallLog } from 'app/repositories/tool-call-log.js';
import { getMockAnthropicClientIfEnabled } from 'app/test-fixtures/mockAnthropicClient/mockAnthropicClient.js';
import { TOOL_DEFINITIONS } from 'app/tools/definitions.js';
import { type ToolContext, executeTool } from 'app/tools/executor.js';

import {
  AgentOrchestrator,
  type OrchestratorResult,
} from './AgentOrchestrator.js';

export interface AgentResult {
  response: string;
  tool_calls: OrchestratorResult['toolCallsUsed'];
  total_tokens: OrchestratorResult['tokensUsed'];
  nodes: ChatNode[];
}

/**
 * Runs the agentic tool-use loop and assembles typed ChatNode results.
 */
export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  tripContext: TripContext | undefined,
  onEvent: (event: SSEEvent) => void,
  conversationId?: string | null,
  toolContext?: ToolContext,
  enrichmentNodes?: ChatNode[],
  flowPosition?: FlowPosition,
  promptOptions?: { hasCriticalAdvisory?: boolean; nudge?: string | null },
  tracker?: CompletionTracker,
  systemPromptOverride?: string,
  allowedTools?: string[],
  requiredBeforeFormat?: string[],
): Promise<AgentResult> {
  // Emit enrichment nodes first so the frontend can render them immediately
  if (enrichmentNodes) {
    for (const node of enrichmentNodes) {
      onEvent({ type: 'node', node });
    }
  }

  // When E2E_MOCK_ANTHROPIC=1 is set, swap the real Anthropic
  // client for a deterministic stub. This lets the E2E suite
  // boot without an API key and without burning tokens. The
  // orchestrator falls back to constructing a real client when
  // this returns undefined.
  const mockClient = getMockAnthropicClientIfEnabled();

  const tools =
    allowedTools && allowedTools.length > 0
      ? TOOL_DEFINITIONS.filter((t) => allowedTools.includes(t.name))
      : TOOL_DEFINITIONS;

  const orchestrator = new AgentOrchestrator({
    ...(mockClient ? { client: mockClient } : {}),
    tools: tools as Anthropic.Tool[],
    systemPromptBuilder: (ctx: unknown, pos: unknown) =>
      systemPromptOverride ??
      buildSystemPrompt(
        ctx as TripContext | undefined,
        pos as FlowPosition | undefined,
        promptOptions,
        tracker,
      ),
    toolExecutor: (toolName, input, meta) =>
      executeTool(toolName, input, meta as ToolContext | undefined),
    ...(requiredBeforeFormat?.length ? { requiredBeforeFormat } : {}),
    onToolExecuted: (record) => {
      insertToolCallLog({
        conversation_id: conversationId ?? null,
        tool_name: record.tool_name,
        tool_input_json: record.input,
        tool_result_json: record.isError ? null : record.result,
        latency_ms: record.latencyMs,
        cache_hit: false,
        error: record.errorMessage,
      }).catch((logErr) => {
        logger.warn({ err: logErr }, 'Failed to log tool call');
      });
    },
  });

  const meta = toolContext
    ? ({ tripId: toolContext.tripId, userId: toolContext.userId } as Record<
        string,
        unknown
      >)
    : undefined;

  const result = await orchestrator.run(
    messages,
    [tripContext, flowPosition],
    onEvent,
    meta,
  );

  // FIN-04 (2026-04-06 audit): persist per-turn token cost. The
  // orchestrator returns aggregate input/output tokens for the whole
  // turn. Record one row per completed agent run in agent_turn_cost
  // so we can later compute estimate-vs-actual cost per user, per
  // conversation, or per day. Insert is fire-and-forget: a DB
  // failure should not block the user's chat response.
  if (conversationId && result.tokensUsed) {
    insertAgentTurnCost({
      conversation_id: conversationId,
      input_tokens: result.tokensUsed.input,
      output_tokens: result.tokensUsed.output,
      cache_creation_tokens: result.tokensUsed.cache_creation,
      cache_read_tokens: result.tokensUsed.cache_read,
      iterations: result.iterations ?? 0,
      tool_call_count: result.toolCallsUsed?.length ?? 0,
    }).catch((err) => {
      logger.warn({ err }, 'Failed to persist agent turn cost');
    });
  }

  // Assemble final node array per spec order
  const finalNodes: ChatNode[] = [];

  // 1. Enrichment nodes
  if (enrichmentNodes) finalNodes.push(...enrichmentNodes);

  // 2. Tool result nodes (excluding budget_bar — reorder below)
  const toolNodes = result.nodes.filter((n) => n.type !== 'budget_bar');
  finalNodes.push(...toolNodes);

  // 3. Plan card node (PLAN_TRIP phase only, emitted before text)
  if (result.formatResponse?.plan_card) {
    finalNodes.push({
      type: 'plan_card',
      plan_card: result.formatResponse.plan_card as TripPlanCard,
    });
  }

  // 4. Text node from format_response or fallback to raw response
  if (result.formatResponse) {
    finalNodes.push({
      type: 'text',
      content: result.formatResponse.text,
      citations: result.formatResponse.citations as Citation[] | undefined,
    });
  } else if (result.response) {
    logger.warn(
      'Agent completed without calling format_response — using raw text fallback',
    );
    finalNodes.push({ type: 'text', content: result.response });
  }

  // 5. Budget bar (moved to after text)
  const budgetNode = result.nodes.find((n) => n.type === 'budget_bar');
  if (budgetNode) finalNodes.push(budgetNode);

  // 6. Advisory from format_response
  if (result.formatResponse?.advisory) {
    finalNodes.push({
      type: 'advisory',
      ...result.formatResponse.advisory,
    });
  }

  // 7. Quick replies
  if (result.formatResponse?.quick_replies?.length) {
    finalNodes.push({
      type: 'quick_replies',
      options: result.formatResponse.quick_replies,
    });
  }

  return {
    response: result.formatResponse?.text ?? result.response,
    tool_calls: result.toolCallsUsed,
    total_tokens: result.tokensUsed,
    nodes: finalNodes,
  };
}
