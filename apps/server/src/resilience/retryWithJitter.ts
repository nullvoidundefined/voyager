/**
 * Retries an async operation a bounded number of times with jittered backoff,
 * but only when the supplied predicate deems the error retryable. Exists so
 * idempotent outbound calls can absorb a single transient blip without a
 * hand-rolled retry loop at every call site. The caller decides what is
 * retryable (e.g. network/timeout rejections, never a 4xx).
 */
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_BASE_DELAY_MS = 250;
const JITTER_FLOOR = 0.5;

export interface RetryOptions {
  shouldRetry: (err: Error) => boolean;
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeJitteredDelay(baseDelayMs: number, attempt: number): number {
  const jitter = JITTER_FLOOR + Math.random() * (1 - JITTER_FLOOR);
  return baseDelayMs * attempt * jitter;
}

export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    shouldRetry,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    sleep = defaultSleep,
  } = options;

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }
      await sleep(computeJitteredDelay(baseDelayMs, attempt));
    }
  }
  throw lastError ?? new Error('retryWithJitter: no attempts were made');
}
