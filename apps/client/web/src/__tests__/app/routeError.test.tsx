import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RouteError from '@/app/error';

const captureClientException = vi.fn();
vi.mock('@/clients/posthog', () => ({
  captureClientException: (...args: unknown[]) =>
    captureClientException(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('app/error route boundary', () => {
  it('reports the error to telemetry on mount', () => {
    const error = Object.assign(new Error('route crash'), { digest: 'abc' });
    render(<RouteError error={error} reset={vi.fn()} />);

    expect(captureClientException).toHaveBeenCalledTimes(1);
    const [reported, context] = captureClientException.mock.calls[0]!;
    expect((reported as Error).message).toBe('route crash');
    expect(context).toMatchObject({ digest: 'abc', scope: 'route' });
  });

  it('calls reset when the user clicks Try again', () => {
    const reset = vi.fn();
    render(<RouteError error={new Error('x')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
