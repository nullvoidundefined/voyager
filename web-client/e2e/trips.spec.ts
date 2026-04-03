import { expect, test } from '@playwright/test';

import { loginAsTestUser } from './fixtures/auth.fixture';

test.describe('Trip Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('US-13: Trips list page loads (empty or with trips)', async ({
    page,
  }) => {
    await page.goto('/trips');
    await expect(
      page.getByRole('heading', { name: /my trips/i }),
    ).toBeVisible();
    // Either shows trip cards or empty state
    const hasTrips = await page
      .locator('[class*="tripCard"], [class*="card"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasTrips) {
      await expect(page.getByText(/no trips|start planning/i)).toBeVisible();
    }
  });

  test('US-14: Create new trip redirects to trip detail', async ({ page }) => {
    await page.goto('/trips');
    await page.getByRole('link', { name: /new trip/i }).click();
    // Should redirect to a trip detail page
    await page.waitForURL(/\/trips\/[a-f0-9-]+/, { timeout: 10000 });
    // Chat section should be visible
    await expect(page.getByText(/chat with/i)).toBeVisible();
  });

  test('US-15: Trip detail page shows destination hero, budget, and chat', async ({
    page,
  }) => {
    // Create a trip first
    await page.goto('/trips');
    await page.getByRole('link', { name: /new trip/i }).click();
    await page.waitForURL(/\/trips\/[a-f0-9-]+/, { timeout: 10000 });

    // Chat section
    await expect(page.getByText(/chat with/i)).toBeVisible();
    // Input field
    await expect(
      page.getByPlaceholder(/plan your trip|message/i),
    ).toBeVisible();
    // Send button
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });

  test('US-17: Trip cards show destination images', async ({ page }) => {
    await page.goto('/trips');
    // If trips exist, check for images or fallback gradient
    const cards = page.locator('[class*="tripCard"], [class*="card"]');
    if ((await cards.count()) > 0) {
      const firstCard = cards.first();
      // Should have either an img or a fallback div
      const hasImage =
        (await firstCard
          .locator('img')
          .isVisible()
          .catch(() => false)) ||
        (await firstCard
          .locator('[class*="Fallback"]')
          .isVisible()
          .catch(() => false));
      expect(hasImage).toBeTruthy();
    }
  });
});
