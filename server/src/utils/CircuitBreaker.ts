import { logger } from 'app/utils/logs/logger.js';

type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
  /** Optional predicate to decide if an error should count toward the threshold. Defaults to always true. */
  isRetryable?: (err: Error) => boolean;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly isRetryable: (err: Error) => boolean;

  constructor(name: string, options: CircuitBreakerOptions) {
    this.name = name;
    this.failureThreshold = options.failureThreshold;
    this.cooldownMs = options.cooldownMs;
    this.isRetryable = options.isRetryable ?? (() => true);
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = 'half-open';
        logger.info(
          { name: this.name },
          'Circuit breaker half-open — allowing probe',
        );
      } else {
        throw new Error(
          `${this.name} is temporarily unavailable (circuit open)`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      logger.info(
        { name: this.name },
        'Circuit breaker closed — probe succeeded',
      );
    }
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(err: Error): void {
    if (!this.isRetryable(err)) return;

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
      logger.warn(
        { name: this.name },
        'Circuit breaker re-opened — probe failed',
      );
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      logger.warn(
        { name: this.name, failureCount: this.failureCount },
        'Circuit breaker opened',
      );
    }
  }
}
