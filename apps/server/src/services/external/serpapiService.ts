import { logger } from 'app/clients/logger.js';
import { CircuitBreaker } from 'app/resilience/CircuitBreaker.js';
import {
  incrementMonthlyUsage,
  isOverMonthlyCap,
} from 'app/services/cache/serpApiQuotaService.js';

/**
 * Thrown when serpApiGet is called but the monthly SerpApi quota has
 * been reached. Callers (flight / hotel tools) should catch this
 * specifically and return a graceful "temporarily unavailable"
 * result to the agent rather than letting the agent hallucinate
 * data from an error string.
 */
export class SerpApiQuotaExceededError extends Error {
  constructor() {
    super(
      'SerpApi monthly quota cap reached. Live flight and hotel search is temporarily unavailable.',
    );
    this.name = 'SerpApiQuotaExceededError';
  }
}

const serpApiBreaker = new CircuitBreaker('SerpApi', {
  failureThreshold: 3,
  cooldownMs: 60_000,
  isRetryable: (err) => !err.message.includes('400'),
});

function getApiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    throw new Error('SERPAPI_API_KEY is required');
  }
  return key;
}

export async function serpApiGet(
  engine: string,
  params: Record<string, string | number | undefined>,
  requestId?: string,
): Promise<unknown> {
  // FIN-02: refuse to call past the monthly cap. Caller can catch
  // SerpApiQuotaExceededError and return a graceful fallback to the
  // agent instead of letting the agent hallucinate from an error
  // string.
  if (await isOverMonthlyCap()) {
    logger.warn(
      { engine, requestId },
      'SerpApi monthly quota cap reached, refusing call',
    );
    throw new SerpApiQuotaExceededError();
  }

  const apiKey = getApiKey();

  const query = Object.entries({ ...params, engine, api_key: apiKey })
    .filter(([, v]) => v !== undefined)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join('&');

  const url = `https://serpapi.com/search.json?${query}`;

  logger.debug({ engine, params, requestId }, 'SerpApi request');

  return serpApiBreaker.call(async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!response.ok) {
      const text = await response.text();
      logger.error(
        { status: response.status, body: text, requestId },
        'SerpApi request failed',
      );
      throw new Error(`SerpApi error: ${response.status} ${text}`);
    }

    const data: unknown = await response.json();

    // FIN-02: only increment the counter on a successful non-cached
    // response. Cache hits in the tool layer do not touch the real
    // SerpApi endpoint, so they should not count against the cap.
    // Increment AFTER parsing succeeds so a failed parse does not
    // consume quota.
    void incrementMonthlyUsage();

    return data;
  });
}
