import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from './CircuitBreaker.js';

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through successful calls in closed state', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      cooldownMs: 5000,
    });
    const result = await cb.call(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('opens after failureThreshold consecutive failures', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      cooldownMs: 5000,
    });
    const fail = () => Promise.reject(new Error('fail'));

    await expect(cb.call(fail)).rejects.toThrow('fail');
    await expect(cb.call(fail)).rejects.toThrow('fail');
    await expect(cb.call(fail)).rejects.toThrow('fail');

    // Now circuit should be open — next call fails fast
    await expect(cb.call(() => Promise.resolve('ok'))).rejects.toThrow(
      'temporarily unavailable',
    );
  });

  it('resets failure count on success', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      cooldownMs: 5000,
    });
    const fail = () => Promise.reject(new Error('fail'));

    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(fail)).rejects.toThrow();
    // Success resets the count
    await cb.call(() => Promise.resolve('ok'));
    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(fail)).rejects.toThrow();
    // Still closed — only 2 consecutive failures
    const result = await cb.call(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
  });

  it('transitions to half-open after cooldown and allows one probe', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      cooldownMs: 1000,
    });
    const fail = () => Promise.reject(new Error('fail'));

    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(fail)).rejects.toThrow();
    // Open
    await expect(cb.call(() => Promise.resolve('x'))).rejects.toThrow(
      'unavailable',
    );

    // Advance past cooldown
    vi.advanceTimersByTime(1100);

    // Half-open: one probe allowed
    const result = await cb.call(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
  });

  it('re-opens if probe fails in half-open state', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      cooldownMs: 1000,
    });
    const fail = () => Promise.reject(new Error('fail'));

    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(fail)).rejects.toThrow();

    vi.advanceTimersByTime(1100);

    // Probe fails
    await expect(cb.call(fail)).rejects.toThrow('fail');
    // Back to open
    await expect(cb.call(() => Promise.resolve('x'))).rejects.toThrow(
      'unavailable',
    );
  });

  it('only retries on 5xx-like errors, not 4xx', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      cooldownMs: 1000,
      isRetryable: (err) => !err.message.includes('400'),
    });

    // 400 errors don't count toward threshold
    const badRequest = () => Promise.reject(new Error('400 Bad Request'));
    await expect(cb.call(badRequest)).rejects.toThrow('400');
    await expect(cb.call(badRequest)).rejects.toThrow('400');
    // Circuit still closed
    const result = await cb.call(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });
});
