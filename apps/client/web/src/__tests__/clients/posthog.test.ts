import { afterEach, describe, expect, it, vi } from 'vitest';

import { captureClientException } from '@/clients/posthog';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('captureClientException', () => {
  it('falls back to console.error when telemetry is not initialized', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('uninitialized');

    captureClientException(error, { scope: 'test' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toContain(error);
  });

  it('normalizes a non-Error value before reporting', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    captureClientException('a string failure');

    const reported = spy.mock.calls[0]![1];
    expect(reported).toBeInstanceOf(Error);
    expect((reported as Error).message).toBe('a string failure');
  });
});
