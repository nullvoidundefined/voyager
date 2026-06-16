import { query } from 'app/database/pool/pool.js';

/**
 * Sonnet 4.6 pricing. Units are dollars per million tokens.
 * Cache write tokens are billed at 1.25x base input rate.
 * Cache read tokens are billed at 0.1x base input rate.
 */
export const SONNET_4_INPUT_USD_PER_MTOK = 3;
export const SONNET_4_CACHE_WRITE_USD_PER_MTOK = 3.75;
export const SONNET_4_CACHE_READ_USD_PER_MTOK = 0.3;
export const SONNET_4_OUTPUT_USD_PER_MTOK = 15;

export interface AgentTurnCostInput {
  conversation_id: string;
  message_id?: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
  iterations: number;
  tool_call_count: number;
}

/**
 * Compute estimated cost in USD. Cache reads are 10x cheaper than base
 * input; cache writes are 1.25x more expensive. Returns a value with up
 * to 6 decimal places, matching the numeric(10,6) column type.
 */
export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens = 0,
  cacheReadTokens = 0,
): number {
  const input = (inputTokens / 1_000_000) * SONNET_4_INPUT_USD_PER_MTOK;
  const cacheWrite =
    (cacheCreationTokens / 1_000_000) * SONNET_4_CACHE_WRITE_USD_PER_MTOK;
  const cacheRead =
    (cacheReadTokens / 1_000_000) * SONNET_4_CACHE_READ_USD_PER_MTOK;
  const output = (outputTokens / 1_000_000) * SONNET_4_OUTPUT_USD_PER_MTOK;
  return (
    Math.round((input + cacheWrite + cacheRead + output) * 1_000_000) /
    1_000_000
  );
}

/**
 * Insert one row recording the aggregate token cost of a completed
 * agent-loop turn.
 */
export async function insertAgentTurnCost(
  input: AgentTurnCostInput,
): Promise<void> {
  const cost = estimateCostUsd(
    input.input_tokens,
    input.output_tokens,
    input.cache_creation_tokens,
    input.cache_read_tokens,
  );
  await query(
    `INSERT INTO agent_turn_cost
       (conversation_id, message_id, input_tokens, output_tokens,
        estimated_cost_usd, iterations, tool_call_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.conversation_id,
      input.message_id ?? null,
      input.input_tokens,
      input.output_tokens,
      cost,
      input.iterations,
      input.tool_call_count,
    ],
  );
}
