import { logger } from 'app/clients/logger.js';
import { getRedis } from 'app/clients/redis.js';

export const DEFAULT_DAILY_OUTPUT_TOKEN_BUDGET = 50_000;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function keyFor(userId: string): string {
  return `token-budget:${userId}:${todayUtc()}`;
}

export async function getDailyTokenUsage(userId: string): Promise<number> {
  const client = getRedis();
  if (!client) {
    return 0;
  }
  try {
    const raw = await client.get(keyFor(userId));
    if (raw === null) {
      return 0;
    }
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (err) {
    logger.error(
      { err, userId },
      'Failed to read token budget counter, failing open',
    );
    return 0;
  }
}

export async function addTokenUsage(
  userId: string,
  tokens: number,
): Promise<void> {
  if (tokens <= 0) {
    return;
  }
  const client = getRedis();
  if (!client) {
    return;
  }
  try {
    const key = keyFor(userId);
    await client.incrby(key, tokens);
    // 25 hours: 24h for the day plus 1h safety margin for timezone skew.
    await client.expire(key, 25 * 60 * 60);
  } catch (err) {
    logger.error(
      { err, userId, tokens },
      'Failed to increment token budget counter',
    );
  }
}

export async function isOverDailyBudget(
  userId: string,
  budget: number = DEFAULT_DAILY_OUTPUT_TOKEN_BUDGET,
): Promise<boolean> {
  const usage = await getDailyTokenUsage(userId);
  return usage >= budget;
}

export async function resetTokenBudget(userId: string): Promise<void> {
  const client = getRedis();
  if (!client) {
    return;
  }
  try {
    await client.del(keyFor(userId));
  } catch (err) {
    logger.error({ err, userId }, 'Failed to reset token budget counter');
  }
}
