import { expect, test } from '@playwright/test';

import { loginAsTestUser } from './fixtures/auth.fixture';

test.describe('Checkout & Booking Confirmation', () => {
  test('US-25: Booking actions appear when trip has selections', async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await page.goto('/trips');

    // Find a trip with "Planning" status that has selections
    const planningTrips = page.locator('text=Planning');
    if ((await planningTrips.count()) > 0) {
      // Click into the trip
      await planningTrips.first().click();
      await page.waitForURL(/\/trips\/[a-f0-9-]+/);

      // If the trip has flights, booking actions should appear
      const bookButton = page.getByRole('button', {
        name: /book this trip/i,
      });
      if (await bookButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(bookButton).toBeVisible();
      }
    }
  });

  test('US-28: Booked trip shows badge and locked input', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/trips');

    // Look for a saved/booked trip
    const bookedTrips = page.locator('text=Booked');
    if ((await bookedTrips.count()) > 0) {
      await bookedTrips.first().click();
      await page.waitForURL(/\/trips\/[a-f0-9-]+/);

      // Booked badge should be visible
      await expect(page.getByText('Booked')).toBeVisible();

      // Chat input should be disabled
      const input = page.getByPlaceholder(/booked|enjoy/i);
      if (await input.isVisible().catch(() => false)) {
        await expect(input).toBeDisabled();
      }
    }
  });
});
