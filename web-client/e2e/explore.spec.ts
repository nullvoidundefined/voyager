import { expect, test } from '@playwright/test';

test.describe('Explore Destinations', () => {
  test('US-2: Explore page shows destination cards', async ({ page }) => {
    await page.goto('/explore');
    await expect(
      page.getByRole('heading', { name: /discover/i }),
    ).toBeVisible();

    // Should show destination cards (at least some of the 30)
    const cards = page.locator('a[href^="/explore/"]');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('US-3: Category filters narrow the grid', async ({ page }) => {
    await page.goto('/explore');

    // Count all destinations
    const allCards = page.locator('a[href^="/explore/"]');
    const allCount = await allCards.count();

    // Click a category filter (e.g., Beach)
    await page.getByRole('button', { name: /beach/i }).click();

    // Should show fewer destinations
    const filteredCount = await allCards.count();
    expect(filteredCount).toBeLessThan(allCount);
    expect(filteredCount).toBeGreaterThan(0);

    // Click "All" to reset
    await page.getByRole('button', { name: 'All' }).click();
    const resetCount = await allCards.count();
    expect(resetCount).toBe(allCount);
  });

  test('US-4: Destination detail page shows full content', async ({ page }) => {
    await page.goto('/explore/tokyo');

    // Hero with city name
    await expect(page.getByText('Tokyo')).toBeVisible();
    await expect(page.getByText('Japan')).toBeVisible();

    // Quick stats
    await expect(page.getByText(/yen|JPY|¥/i)).toBeVisible();

    // Sections present
    await expect(
      page.getByRole('heading', { name: /experiences/i }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /dining/i })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /neighborhoods/i }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /weather/i })).toBeVisible();

    // CTA button
    await expect(
      page.getByRole('link', { name: /plan a trip/i }),
    ).toBeVisible();
  });

  test('US-5: Plan a trip CTA redirects unauthenticated users to login', async ({
    page,
  }) => {
    await page.goto('/explore/tokyo');
    await page.getByRole('link', { name: /plan a trip/i }).click();
    // Should redirect to login (since not authenticated)
    await page.waitForURL(/\/login/);
  });
});
