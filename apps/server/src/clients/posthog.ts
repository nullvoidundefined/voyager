/**
 * PostHog analytics client singleton for server-side event capture and
 * exception autocapture. Constructed once here so all server code shares one
 * configured instance; an empty API key disables capture in local/test runs.
 */
import { PostHog } from 'posthog-node';

import { env } from 'app/config/env.js';

export const posthog = new PostHog(env.POSTHOG_API_KEY ?? '', {
  host: env.POSTHOG_HOST,
  enableExceptionAutocapture: true,
});
