/**
 * Lazily-connected ioredis singleton used by the cache and rate-limit layers.
 * Returns null when REDIS_URL is unset so those layers can degrade gracefully
 * and tests can run without a live Redis instance.
 */
import { Redis } from 'ioredis';

import { logger } from 'app/clients/logger.js';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on('error', (err: Error) => {
      logger.error({ err }, 'Redis connection error');
    });
    return redis;
  } catch (err) {
    logger.warn({ err }, 'Failed to create Redis client');
    return null;
  }
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  if (!client) {
    logger.warn('REDIS_URL not set, cache/quota/budget disabled');
    return;
  }
  await client.connect();
  logger.info('Redis connected');
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis disconnected');
  }
}
