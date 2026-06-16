import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRedis } from 'app/clients/redis.js';

import {
  addTokenUsage,
  getDailyTokenUsage,
  isOverDailyBudget,
} from '../tokenBudgetService.js';

const mockRedisInstance = {
  get: vi.fn(),
  incrby: vi.fn(),
  expire: vi.fn(),
};

vi.mock('app/clients/redis.js', () => ({
  getRedis: vi.fn(() => mockRedisInstance),
}));

vi.mock('app/clients/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('tokenBudgetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRedis).mockReturnValue(mockRedisInstance as never);
  });

  describe('getDailyTokenUsage', () => {
    it('returns 0 when no counter exists for the user today', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const usage = await getDailyTokenUsage('user-1');
      expect(usage).toBe(0);
    });

    it('returns the parsed integer value from Redis', async () => {
      mockRedisInstance.get.mockResolvedValue('12345');
      const usage = await getDailyTokenUsage('user-1');
      expect(usage).toBe(12345);
    });

    it('returns 0 when Redis is unavailable (graceful degrade)', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      const usage = await getDailyTokenUsage('user-1');
      expect(usage).toBe(0);
    });

    it('uses a key scoped to user and current UTC date', async () => {
      mockRedisInstance.get.mockResolvedValue('100');
      await getDailyTokenUsage('user-42');
      const callArg = mockRedisInstance.get.mock.calls[0]?.[0] as string;
      expect(callArg).toContain('token-budget');
      expect(callArg).toContain('user-42');
      const today = new Date().toISOString().slice(0, 10);
      expect(callArg).toContain(today);
    });
  });

  describe('addTokenUsage', () => {
    it('increments the Redis counter by the given amount', async () => {
      mockRedisInstance.incrby.mockResolvedValue(5000);
      mockRedisInstance.expire.mockResolvedValue(1);
      await addTokenUsage('user-1', 5000);
      expect(mockRedisInstance.incrby).toHaveBeenCalledWith(
        expect.stringContaining('user-1'),
        5000,
      );
    });

    it('sets a TTL so the counter resets daily', async () => {
      mockRedisInstance.incrby.mockResolvedValue(100);
      mockRedisInstance.expire.mockResolvedValue(1);
      await addTokenUsage('user-1', 100);
      expect(mockRedisInstance.expire).toHaveBeenCalled();
    });

    it('is a no-op if tokens is zero or negative', async () => {
      await addTokenUsage('user-1', 0);
      await addTokenUsage('user-1', -5);
      expect(mockRedisInstance.incrby).not.toHaveBeenCalled();
    });

    it('does not throw when Redis is unavailable', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      await expect(addTokenUsage('user-1', 1000)).resolves.toBeUndefined();
    });
  });

  describe('isOverDailyBudget', () => {
    it('returns false when usage is under the budget', async () => {
      mockRedisInstance.get.mockResolvedValue('10000');
      const over = await isOverDailyBudget('user-1', 50000);
      expect(over).toBe(false);
    });

    it('returns true when usage equals the budget', async () => {
      mockRedisInstance.get.mockResolvedValue('50000');
      const over = await isOverDailyBudget('user-1', 50000);
      expect(over).toBe(true);
    });

    it('returns true when usage exceeds the budget', async () => {
      mockRedisInstance.get.mockResolvedValue('60000');
      const over = await isOverDailyBudget('user-1', 50000);
      expect(over).toBe(true);
    });

    it('uses DEFAULT_DAILY_OUTPUT_TOKEN_BUDGET when no explicit budget is passed', async () => {
      mockRedisInstance.get.mockResolvedValue('40000');
      const over = await isOverDailyBudget('user-1');
      expect(over).toBe(false);
    });

    it('fails open (returns false) when Redis is unavailable', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      const over = await isOverDailyBudget('user-1', 50000);
      expect(over).toBe(false);
    });
  });
});
