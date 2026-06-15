/**
 * Anthropic SDK client wrapper: the single place the LLM SDK is constructed.
 * Exposed as a lazily-initialized singleton so handlers, services, and the agent
 * orchestrator never call `new Anthropic()` directly (layering rule R-220/R-222).
 * Tests inject their own client via orchestrator config, so this fallback path
 * is exercised only in real runtime.
 */
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getLlmClient(): Anthropic {
  if (client === null) {
    client = new Anthropic();
  }
  return client;
}
