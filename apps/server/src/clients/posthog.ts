/**
 * PostHog analytics client singleton for server-side event capture and
 * exception autocapture. Constructed once here so all server code shares one
 * configured instance; an empty API key disables capture in local/test runs.
 */
import { PostHog } from 'posthog-node';

export const posthog = new PostHog(process.env.POSTHOG_API_KEY ?? '', {
  host: process.env.POSTHOG_HOST,
  enableExceptionAutocapture: true,
});
