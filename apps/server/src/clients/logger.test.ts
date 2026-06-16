import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the pino logger configuration. ENG-18 flagged this
 * file at 0% branch coverage. The only branch is the NODE_ENV
 * check that swaps in pino-pretty for development.
 *
 * The tests import the module fresh after setting NODE_ENV so
 * the module-load-time branch is exercised in both directions.
 */

describe('logger', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
    vi.resetModules();
  });

  it('exports a logger with the standard pino level methods', async () => {
    process.env.NODE_ENV = 'test';
    const { logger } = await import('./logger.js');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('uses debug level when NODE_ENV is not production', async () => {
    process.env.NODE_ENV = 'development';
    const { logger } = await import('./logger.js');
    expect(logger.level).toBe('debug');
  });

  it('uses info level when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    const { logger } = await import('./logger.js');
    expect(logger.level).toBe('info');
  });

  it('does not throw when invoked with typical structured log shapes', async () => {
    process.env.NODE_ENV = 'test';
    const { logger } = await import('./logger.js');

    // Each of these mirrors a typical call in the codebase.
    expect(() => logger.info('plain string')).not.toThrow();
    expect(() =>
      logger.info({ event: 'test', tripId: 'abc' }, 'structured'),
    ).not.toThrow();
    expect(() =>
      logger.error(
        { err: new Error('boom'), userId: 'u1' },
        'error with error object',
      ),
    ).not.toThrow();
    expect(() => logger.warn('warn line')).not.toThrow();
    expect(() => logger.debug({ count: 1 }, 'debug')).not.toThrow();
  });
});
