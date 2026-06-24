/**
 * Classifies an Anthropic SDK error as transient (worth tripping the circuit
 * breaker over) versus a caller error that should fail fast. Transient covers
 * rate limits, overload, 5xx, and connection/timeout/abort failures; 4xx other
 * than 429 (a bad request) is not transient and must not open the breaker.
 */
const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504, 529]);

const TRANSIENT_ERROR_NAMES = new Set([
  'AbortError',
  'APIConnectionError',
  'APIConnectionTimeoutError',
  'TimeoutError',
]);

export function isTransientAnthropicError(err: Error): boolean {
  const status = (err as { status?: number }).status;
  if (typeof status === 'number') {
    return TRANSIENT_STATUS_CODES.has(status);
  }
  return TRANSIENT_ERROR_NAMES.has(err.name);
}
