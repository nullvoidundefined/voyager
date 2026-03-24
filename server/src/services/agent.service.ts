import Anthropic from "@anthropic-ai/sdk";

import { buildSystemPrompt } from "app/prompts/system-prompt.js";
import type { TripContext } from "app/prompts/trip-context.js";
import { TOOL_DEFINITIONS } from "app/tools/definitions.js";
import { executeTool } from "app/tools/executor.js";
import { logger } from "app/utils/logs/logger.js";

const MAX_TOOL_CALLS = 15;

interface ToolCallRecord {
  tool_name: string;
  tool_id: string;
  input: Record<string, unknown>;
  result: unknown;
}

interface AgentResult {
  response: string;
  tool_calls: ToolCallRecord[];
  total_tokens: { input: number; output: number };
}

type ProgressEvent =
  | { type: "tool_start"; tool_name: string; tool_id: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_id: string; result: unknown }
  | { type: "assistant"; text: string };

export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  tripContext: TripContext | undefined,
  onEvent: (event: ProgressEvent) => void,
): Promise<AgentResult> {
  const client = new Anthropic();
  const systemPrompt = buildSystemPrompt(tripContext);
  const toolCalls: ToolCallRecord[] = [];
  const totalTokens = { input: 0, output: 0 };

  const conversationMessages = [...messages];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOL_DEFINITIONS as Anthropic.Tool[],
      messages: conversationMessages,
    });

    totalTokens.input += response.usage.input_tokens;
    totalTokens.output += response.usage.output_tokens;

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text",
      );
      const text = textBlock?.text ?? "";
      onEvent({ type: "assistant", text });
      return { response: text, tool_calls: toolCalls, total_tokens: totalTokens };
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      // Check tool call limit before executing
      if (toolCalls.length + toolUseBlocks.length > MAX_TOOL_CALLS) {
        return {
          response:
            "I've reached the tool call limit for this turn. Please send another message to continue.",
          tool_calls: toolCalls,
          total_tokens: totalTokens,
        };
      }

      // Add assistant message with tool use blocks
      conversationMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        const input = block.input as Record<string, unknown>;
        onEvent({ type: "tool_start", tool_name: block.name, tool_id: block.id, input });

        let result: unknown;
        let isError = false;

        try {
          result = await executeTool(block.name, input);
        } catch (err) {
          isError = true;
          result = `Error: ${err instanceof Error ? err.message : String(err)}`;
          logger.error({ err, toolName: block.name }, "Tool execution failed");
        }

        toolCalls.push({ tool_name: block.name, tool_id: block.id, input, result });
        onEvent({ type: "tool_result", tool_id: block.id, result });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: typeof result === "string" ? result : JSON.stringify(result),
          ...(isError && { is_error: true }),
        });
      }

      conversationMessages.push({ role: "user", content: toolResults });
    }
  }
}
