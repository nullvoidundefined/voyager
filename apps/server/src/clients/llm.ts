/**
 * Anthropic SDK client factory: the single place the LLM SDK is constructed,
 * so handlers, services, and the agent orchestrator never call `new Anthropic()`
 * directly (layering rule R-220/R-222). A plain factory rather than a cached
 * singleton: it preserves the existing per-construction behavior the agent tests
 * rely on (each orchestrator gets a fresh client), and the SDK client is cheap
 * to build and holds no expensive shared state.
 */
import Anthropic from '@anthropic-ai/sdk';

// Per-request timeout bounds a single hung LLM call (the SDK default is ~10
// minutes, far longer than the agent loop's 120s wall-clock budget). maxRetries
// keeps the SDK's built-in backoff for transient 429/5xx.
const LLM_MAX_RETRIES = 2;
const LLM_REQUEST_TIMEOUT_MS = 45_000;

export function getLlmClient(): Anthropic {
  return new Anthropic({
    maxRetries: LLM_MAX_RETRIES,
    timeout: LLM_REQUEST_TIMEOUT_MS,
  });
}
