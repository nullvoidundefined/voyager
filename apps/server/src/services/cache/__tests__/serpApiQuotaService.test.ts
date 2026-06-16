import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRedis } from 'app/clients/redis.js';

import {
  SERPAPI_MONTHLY_CAP,
  getMonthlyUsage,
  incrementMonthlyUsage,
  isOverMonthlyCap,
} from '../serpApiQuotaService.js';

const mockRedisInstance = {
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

vi.mock('app/clients/redis.js', () => ({
  getRedis: vi.fn(() => mockRedisInstance),
}));

vi.mock('app/clients/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('serpApiQuotaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRedis).mockReturnValue(mockRedisInstance as never);
  });

  describe('SERPAPI_MONTHLY_CAP', () => {
    it('is set to 200', () => {
      expect(SERPAPI_MONTHLY_CAP).toBe(200);
    });
  });

  describe('getMonthlyUsage', () => {
    it('returns 0 when counter does not exist', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const usage = await getMonthlyUsage();
      expect(usage).toBe(0);
    });

    it('returns the parsed integer from Redis', async () => {
      mockRedisInstance.get.mockResolvedValue('175');
      const usage = await getMonthlyUsage();
      expect(usage).toBe(175);
    });

    it('uses a key scoped to current YYYY-MM', async () => {
      mockRedisInstance.get.mockResolvedValue('0');
      await getMonthlyUsage();
      const callArg = mockRedisInstance.get.mock.calls[0]?.[0] as string;
      expect(callArg).toContain('serpapi-quota');
      const yyyymm = new Date().toISOString().slice(0, 7);
      expect(callArg).toContain(yyyymm);
    });

    it('returns 0 when Redis is unavailable (fails open)', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      const usage = await getMonthlyUsage();
      expect(usage).toBe(0);
    });
  });

  describe('incrementMonthlyUsage', () => {
    it('increments the counter by 1', async () => {
      mockRedisInstance.incr.mockResolvedValue(10);
      mockRedisInstance.expire.mockResolvedValue(1);
      await incrementMonthlyUsage();
      expect(mockRedisInstance.incr).toHaveBeenCalledWith(
        expect.stringContaining('serpapi-quota'),
      );
    });

    it('sets a TTL so the counter resets monthly', async () => {
      mockRedisInstance.incr.mockResolvedValue(1);
      mockRedisInstance.expire.mockResolvedValue(1);
      await incrementMonthlyUsage();
      expect(mockRedisInstance.expire).toHaveBeenCalled();
    });

    it('is a no-op when Redis is unavailable', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      await expect(incrementMonthlyUsage()).resolves.toBeUndefined();
      expect(mockRedisInstance.incr).not.toHaveBeenCalled();
    });
  });

  describe('isOverMonthlyCap', () => {
    it('returns false when usage is under the cap', async () => {
      mockRedisInstance.get.mockResolvedValue('100');
      const over = await isOverMonthlyCap();
      expect(over).toBe(false);
    });

    it('returns true when usage equals the cap', async () => {
      mockRedisInstance.get.mockResolvedValue('200');
      const over = await isOverMonthlyCap();
      expect(over).toBe(true);
    });

    it('returns true when usage exceeds the cap', async () => {
      mockRedisInstance.get.mockResolvedValue('250');
      const over = await isOverMonthlyCap();
      expect(over).toBe(true);
    });

    it('fails open (returns false) when Redis is unavailable', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      const over = await isOverMonthlyCap();
      expect(over).toBe(false);
    });
  });
});
