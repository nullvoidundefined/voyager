'use client';

/**
 * Mounts client-side telemetry once for the whole app. Initializing inside an
 * effect (not at module load) keeps PostHog out of the server render and runs
 * only in the browser. Renders its children unchanged; it exists purely for the
 * init side effect at the root of the tree.
 */
import { useEffect } from 'react';

import { initTelemetry } from '@/clients/posthog';

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initTelemetry();
  }, []);

  return <>{children}</>;
}
