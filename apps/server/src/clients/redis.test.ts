import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('redisService', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  it('returns null when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;
    const { getRedis } = await import('./redis.js');
    expect(getRedis()).toBeNull();
  });

  it('returns the same instance on repeated calls', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    vi.doMock('ioredis', () => ({
      Redis: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        connect: vi.fn(),
        quit: vi.fn(),
      })),
    }));
    const { getRedis } = await import('./redis.js');
    const a = getRedis();
    const b = getRedis();
    expect(a).toBe(b);
  });

  it('disconnectRedis nulls the singleton', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const mockQuit = vi.fn().mockResolvedValue('OK');
    vi.doMock('ioredis', () => ({
      Redis: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        connect: vi.fn(),
        quit: mockQuit,
      })),
    }));
    const { getRedis, disconnectRedis } = await import('./redis.js');
    expect(getRedis()).not.toBeNull();
    await disconnectRedis();
    expect(mockQuit).toHaveBeenCalled();
  });
});
