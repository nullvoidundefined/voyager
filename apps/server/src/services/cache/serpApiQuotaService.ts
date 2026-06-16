import { logger } from 'app/clients/logger.js';
import { getRedis } from 'app/clients/redis.js';

export const SERPAPI_MONTHLY_CAP = 200;

function yyyymmUtc(): string {
  return new Date().toISOString().slice(0, 7);
}

function keyFor(): string {
  return `serpapi-quota:${yyyymmUtc()}`;
}

export async function getMonthlyUsage(): Promise<number> {
  const client = getRedis();
  if (!client) {
    return 0;
  }
  try {
    const raw = await client.get(keyFor());
    if (raw === null) {
      return 0;
    }
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (err) {
    logger.error({ err }, 'Failed to read SerpApi quota counter, failing open');
    return 0;
  }
}

export async function incrementMonthlyUsage(): Promise<void> {
  const client = getRedis();
  if (!client) {
    return;
  }
  try {
    const key = keyFor();
    await client.incr(key);
    // 32 days: covers any month length plus a one-day safety margin.
    await client.expire(key, 32 * 24 * 60 * 60);
  } catch (err) {
    logger.error({ err }, 'Failed to increment SerpApi quota counter');
  }
}

export async function isOverMonthlyCap(): Promise<boolean> {
  const usage = await getMonthlyUsage();
  return usage >= SERPAPI_MONTHLY_CAP;
}
