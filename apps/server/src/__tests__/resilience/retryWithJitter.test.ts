import { describe, expect, it, vi } from 'vitest';

import { retryWithJitter } from 'app/resilience/retryWithJitter.js';

const noSleep = async () => {};

describe('retryWithJitter', () => {
  it('returns the result without retrying on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithJitter(fn, {
      shouldRetry: () => true,
      sleep: noSleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries once on a retryable error then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('recovered');
    const result = await retryWithJitter(fn, {
      shouldRetry: () => true,
      sleep: noSleep,
    });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('do-not-retry'));
    await expect(
      retryWithJitter(fn, { shouldRetry: () => false, sleep: noSleep }),
    ).rejects.toThrow('do-not-retry');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops after maxAttempts and throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always-fails'));
    await expect(
      retryWithJitter(fn, {
        shouldRetry: () => true,
        maxAttempts: 3,
        sleep: noSleep,
      }),
    ).rejects.toThrow('always-fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
