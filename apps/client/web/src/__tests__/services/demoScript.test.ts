import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runDemoScript } from '@/services/demoScript';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runDemoScript', () => {
  it('calls onMessage for each script step', async () => {
    const onMessage = vi.fn();
    const stop = runDemoScript(onMessage, { intervalMs: 100 });

    await vi.runAllTimersAsync();
    stop();

    expect(onMessage.mock.calls.length).toBeGreaterThan(0);
  });

  it('stop() prevents further calls', async () => {
    const onMessage = vi.fn();
    const stop = runDemoScript(onMessage, { intervalMs: 100 });
    stop();
    await vi.runAllTimersAsync();
    expect(onMessage).not.toHaveBeenCalled();
  });
});
