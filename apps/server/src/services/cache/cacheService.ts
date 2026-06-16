/**
 * Thin JSON cache facade over Redis: get/set with safe fallback so a cache
 * outage degrades to a miss rather than an error. Exists so callers can cache
 * without handling Redis connection state or serialization themselves.
 */
import { logger } from 'app/clients/logger.js';
import { connectRedis, disconnectRedis, getRedis } from 'app/clients/redis.js';

export { connectRedis, disconnectRedis, getRedis };

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, key }, 'Cache get failed, treating as miss');
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, 'Cache set failed, data not cached');
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    logger.warn({ err, key }, 'Cache del failed');
  }
}

export function normalizeCacheKey(
  provider: string,
  endpoint: string,
  params: Record<string, unknown>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        const val = params[key];
        acc[key] = typeof val === 'string' ? val.toLowerCase().trim() : val;
        return acc;
      },
      {} as Record<string, unknown>,
    );
  const hash = JSON.stringify(sortedParams);
  return `api_cache:${provider}:${endpoint}:${hash}`;
}
