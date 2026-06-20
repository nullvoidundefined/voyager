import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRedis } from 'app/clients/redis.js';
import {
  cacheDel,
  cacheGet,
  cacheSet,
  normalizeCacheKey,
} from 'app/services/cache/cacheService.js';

const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  connect: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
};

vi.mock('app/clients/redis.js', () => ({
  getRedis: vi.fn(() => mockRedisInstance),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

vi.mock('app/clients/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('cacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRedis).mockReturnValue(mockRedisInstance as never);
  });

  describe('cacheGet', () => {
    it('returns null when Redis is unavailable', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      const result = await cacheGet('any-key');
      expect(result).toBeNull();
    });

    it('returns null when key does not exist', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null);
      const result = await cacheGet('missing-key');
      expect(result).toBeNull();
      expect(mockRedisInstance.get).toHaveBeenCalledWith('missing-key');
    });

    it('returns parsed JSON when key exists', async () => {
      const data = { flights: [{ price: 450 }] };
      mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify(data));
      const result = await cacheGet('flight-key');
      expect(result).toEqual(data);
    });

    it('returns null when Redis throws', async () => {
      mockRedisInstance.get.mockRejectedValueOnce(
        new Error('Connection refused'),
      );
      const result = await cacheGet('failing-key');
      expect(result).toBeNull();
    });
  });

  describe('cacheSet', () => {
    it('stores JSON-serialized value with TTL', async () => {
      const data = { price: 450 };
      await cacheSet('my-key', data, 3600);
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        'my-key',
        JSON.stringify(data),
        'EX',
        3600,
      );
    });

    it('is a no-op when Redis is unavailable', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      await expect(cacheSet('key', { data: 1 }, 3600)).resolves.toBeUndefined();
      expect(mockRedisInstance.set).not.toHaveBeenCalled();
    });

    it('does not throw when Redis throws', async () => {
      mockRedisInstance.set.mockRejectedValueOnce(
        new Error('Connection refused'),
      );
      await expect(
        cacheSet('failing-key', { data: 1 }, 3600),
      ).resolves.toBeUndefined();
    });
  });

  describe('cacheDel', () => {
    it('deletes the key from Redis', async () => {
      await cacheDel('old-key');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('old-key');
    });

    it('does not throw when Redis throws', async () => {
      mockRedisInstance.del.mockRejectedValueOnce(
        new Error('Connection refused'),
      );
      await expect(cacheDel('failing-key')).resolves.toBeUndefined();
    });
  });

  describe('normalizeCacheKey', () => {
    it('generates a deterministic key from sorted params', () => {
      const key1 = normalizeCacheKey('serpapi', 'flight-offers', {
        origin: 'SFO',
        destination: 'BCN',
        date: '2026-07-01',
      });
      const key2 = normalizeCacheKey('serpapi', 'flight-offers', {
        destination: 'BCN',
        date: '2026-07-01',
        origin: 'SFO',
      });
      expect(key1).toBe(key2);
    });

    it('normalizes string values to lowercase and trimmed', () => {
      const key1 = normalizeCacheKey('serpapi', 'flight-offers', {
        origin: '  SFO  ',
      });
      const key2 = normalizeCacheKey('serpapi', 'flight-offers', {
        origin: 'sfo',
      });
      expect(key1).toBe(key2);
    });

    it('includes provider and endpoint in key', () => {
      const key = normalizeCacheKey('google_places', 'text-search', {
        query: 'museum',
      });
      expect(key).toContain('api_cache:google_places:text-search:');
    });

    it('preserves non-string values as-is', () => {
      const key = normalizeCacheKey('serpapi', 'flight-offers', {
        adults: 2,
        max: 5,
      });
      expect(key).toContain('"adults":2');
      expect(key).toContain('"max":5');
    });
  });
});
