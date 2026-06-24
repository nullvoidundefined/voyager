import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';

const captureClientException = vi.fn();
vi.mock('@/clients/posthog', () => ({
  captureClientException: (...args: unknown[]) =>
    captureClientException(...args),
}));

function Boom(): never {
  throw new Error('render crash');
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React logs caught render errors to console.error; silence it for this suite.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  cleanup();
  vi.clearAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>safe content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('shows the fallback and reports the error when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(captureClientException).toHaveBeenCalledTimes(1);
    const [reportedError, context] = captureClientException.mock.calls[0]!;
    expect((reportedError as Error).message).toBe('render crash');
    expect(context).toHaveProperty('componentStack');
  });
});
