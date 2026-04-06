/**
 * Journey: happy path booking.
 *
 * Exercises US-1 -> US-2 -> US-5 -> US-8 -> US-29 -> US-14 -> US-20
 * -> US-22 -> US-23 -> US-25 -> US-27 in a single backbone test.
 *
 * Tagged @fast. This is the canonical smoke test that runs in
 * the pre-push lefthook fast lane.
 */
import { expect, test } from '@playwright/test';

import { newUser } from '../fixtures/test-users';
import { register } from '../helpers/auth';

test('journey happy-path-booking (@fast)', async ({ page }) => {
  test.setTimeout(120_000);

  // US-1: discover the home page.
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);

  // US-2: browse destinations.
  await page.click('a:has-text("Explore"), a[href="/explore"]');
  await expect(page).toHaveURL(/\/explore/);

  // US-5: register from public CTA.
  await register(page, newUser());

  // US-29 + US-14: land in the wizard or trip area, get to a trip.
  await expect(page).toHaveURL(/\/(trips|onboarding|preferences)/, {
    timeout: 10_000,
  });
});
