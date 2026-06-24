/**
 * Browser-side PostHog telemetry wrapper, the client-tier counterpart to the
 * server's posthog client. Initializes once on the client when a key is
 * configured and exposes captureClientException so React error boundaries and
 * route error pages can report crashes to the same sink the server already
 * uses. A no-op (console fallback) when no key is set, so dev and test runs
 * never emit telemetry.
 */
import posthog from 'posthog-js';

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;

export function initTelemetry(): void {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
    capture_pageview: false,
  });
  initialized = true;
}

export function captureClientException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  const normalized = error instanceof Error ? error : new Error(String(error));
  if (!initialized) {
    console.error('Unhandled client error:', normalized, context);
    return;
  }
  posthog.captureException(normalized, context);
}
