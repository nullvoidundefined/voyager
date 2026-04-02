import { logger } from 'app/utils/logs/logger.js';

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
): Promise<unknown> {
  const apiKey = getApiKey();

  const query = Object.entries({ ...params, engine, api_key: apiKey })
    .filter(([, v]) => v !== undefined)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join('&');

  const url = `https://serpapi.com/search.json?${query}`;

  logger.debug({ engine, params }, 'SerpApi request');

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    logger.error(
      { status: response.status, body: text },
      'SerpApi request failed',
    );
    throw new Error(`SerpApi error: ${response.status} ${text}`);
  }

  return response.json();
}
