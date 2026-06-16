'use client';

/**
 * Provides a per-client TanStack QueryClient via lazy useState init, so the
 * instance is created once per browser session (never shared across SSR
 * requests) and carries the app's default stale-time and retry policy.
 */
import { useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
