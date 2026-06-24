'use client';

/**
 * App Router segment error boundary. Next.js renders this when a Server or
 * Client Component in the route subtree throws during render or navigation,
 * cases the class-based ErrorBoundary cannot catch. Reports the error to the
 * telemetry sink and offers a reset.
 */
import { useEffect } from 'react';

import { captureClientException } from '@/clients/posthog';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientException(error, { digest: error.digest, scope: 'route' });
  }, [error]);

  return (
    <div role='alert'>
      <h2>Something went wrong</h2>
      <p>An unexpected error occurred. Please try again.</p>
      <button type='button' onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
