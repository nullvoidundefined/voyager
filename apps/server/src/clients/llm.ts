/**
 * Anthropic SDK client factory: the single place the LLM SDK is constructed,
 * so handlers, services, and the agent orchestrator never call `new Anthropic()`
 * directly (layering rule R-220/R-222). A plain factory rather than a cached
 * singleton: it preserves the existing per-construction behavior the agent tests
 * rely on (each orchestrator gets a fresh client), and the SDK client is cheap
 * to build and holds no expensive shared state.
 */
import Anthropic from '@anthropic-ai/sdk';

export function getLlmClient(): Anthropic {
  return new Anthropic();
}
