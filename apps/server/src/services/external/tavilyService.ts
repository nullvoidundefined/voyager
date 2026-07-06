/**
 * Wraps Tavily web-search requests with the shared circuit breaker. Exists so
 * cold-path inventory discovery has one resilient entry to the search vendor;
 * the TAVILY_API_KEY was provisioned for exactly this discovery use.
 */
import { env } from 'app/config/env.js';
import { CircuitBreaker } from 'app/resilience/CircuitBreaker.js';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const DEFAULT_MAX_RESULTS = 5;

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}

const tavilyBreaker = new CircuitBreaker('Tavily', {
  failureThreshold: 3,
  cooldownMs: 60_000,
  isRetryable: (err) => !err.message.includes('400'),
});

export async function tavilySearch(
  query: string,
  options?: { maxResults?: number },
): Promise<TavilySearchResult[]> {
  const apiKey = env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is required for web discovery');
  }

  return tavilyBreaker.call(async () => {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: options?.maxResults ?? DEFAULT_MAX_RESULTS,
        search_depth: 'basic',
        include_answer: false,
      }),
    });
    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.status}`);
    }
    const data = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return (data.results ?? [])
      .filter(
        (result) => typeof result.url === 'string' && result.url.length > 0,
      )
      .map((result) => ({
        title: result.title ?? '',
        url: result.url as string,
        content: result.content ?? '',
      }));
  });
}
