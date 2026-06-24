'use client';

/**
 * App Router root error boundary. Catches errors thrown in the root layout
 * itself, which the segment error.tsx cannot handle. It replaces the whole
 * document, so it must render its own html and body. Reports to telemetry and
 * offers a reset.
 */
import { useEffect } from 'react';

import { captureClientException } from '@/clients/posthog';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientException(error, { digest: error.digest, scope: 'global' });
  }, [error]);

  return (
    <html lang='en'>
      <body>
        <div role='alert'>
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred. Please try reloading the page.</p>
          <button type='button' onClick={() => reset()}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
