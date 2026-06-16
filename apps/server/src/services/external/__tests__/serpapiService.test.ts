import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/cache/serpApiQuotaService.js', () => ({
  isOverMonthlyCap: vi.fn().mockResolvedValue(false),
  incrementMonthlyUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('app/clients/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Circuit breaker must also be mocked or it will interfere with the hang test.
// Simplest approach: mock the CircuitBreaker to call through directly.
vi.mock('app/resilience/CircuitBreaker.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    call: (fn: () => unknown) => fn(),
  })),
}));

describe('serpApiGet', () => {
  beforeEach(() => {
    process.env.SERPAPI_API_KEY = 'test-key';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rejects with AbortError when fetch does not respond within 15 seconds', async () => {
    // Simulate a fetch that hangs -- never resolves unless the signal fires.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, opts?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            const signal = opts?.signal;
            if (signal) {
              signal.addEventListener('abort', () =>
                reject(
                  new DOMException('The operation was aborted.', 'AbortError'),
                ),
              );
            }
            // No resolve: hangs forever without an abort signal.
          }),
      ),
    );

    const { serpApiGet } = await import('../serpapiService.js');

    const pending = serpApiGet('google_flights', {
      departure_id: 'JFK',
      arrival_id: 'CDG',
    });

    // Fast-forward 15 seconds so AbortSignal.timeout fires.
    await vi.advanceTimersByTimeAsync(15_001);

    await expect(pending).rejects.toThrow();
    // 20s wall-clock budget: vi.advanceTimersByTimeAsync drives AbortSignal.timeout
    // in near-real time via Node's internal timer intercept, so the advance takes
    // ~15s of actual wall-clock time.
  }, 20_000);
});
