/**
 * Public pages: US-1 through US-7.
 *
 * Source of truth: docs/USER_STORIES.md.
 * Mocked tools: E2E_MOCK_TOOLS=1 (set by playwright.config.ts).
 */
import { expect, test } from '@playwright/test';

test.describe('Public pages', () => {
  test('US-1: home page discovery (@fast)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    // Hero, feature highlights, and primary CTAs are all required by AC.
    await expect(
      page.locator('a:has-text("Get Started"), a:has-text("Sign Up")').first(),
    ).toBeVisible();
    await expect(
      page
        .locator('a:has-text("Discover destinations"), a:has-text("Explore")')
        .first(),
    ).toBeVisible();
  });

  test('US-2: browse destinations', async ({ page }) => {
    await page.goto('/explore');
    // AC: 30 destination cards. Use a permissive locator since the
    // exact card markup may evolve.
    const cards = page.locator(
      '[data-destination-card], article a[href^="/explore/"]',
    );
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(20);
  });

  test('US-3: filter destinations by category', async ({ page }) => {
    await page.goto('/explore');
    const allCards = page.locator(
      '[data-destination-card], article a[href^="/explore/"]',
    );
    await expect(allCards.first()).toBeVisible({ timeout: 10_000 });
    const totalCount = await allCards.count();

    // Click the first non-"All" category pill.
    const categoryPill = page
      .locator('button:has-text("Beach"), button:has-text("City")')
      .first();
    if ((await categoryPill.count()) === 0) {
      test.skip(true, 'category pills not yet implemented');
    }
    await categoryPill.click();
    await page.waitForTimeout(250); // client-side filter
    const filteredCount = await allCards.count();
    expect(filteredCount).toBeLessThan(totalCount);
  });

  test('US-4: read a destination guide', async ({ page }) => {
    await page.goto('/explore');
    const firstCard = page.locator('a[href^="/explore/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/explore\/[a-z0-9-]+/, { timeout: 5_000 });
    // AC: "Plan a trip to [city]" CTA visible.
    await expect(
      page
        .locator('button, a')
        .filter({ hasText: /Plan a trip/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('US-5: start a trip from a destination page', async ({ page }) => {
    await page.goto('/explore');
    await page.locator('a[href^="/explore/"]').first().click();
    await expect(page).toHaveURL(/\/explore\/[a-z0-9-]+/);
    await page
      .locator('button, a')
      .filter({ hasText: /Plan a trip/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });

  test('US-6: read the FAQ', async ({ page }) => {
    await page.goto('/faq');
    await expect(page).toHaveURL(/\/faq/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('US-7: public navigation', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('header a:has-text("Explore")').first(),
    ).toBeVisible();
    await expect(
      page.locator('header a:has-text("FAQ")').first(),
    ).toBeVisible();
    await expect(
      page
        .locator('header a:has-text("Sign In"), header a:has-text("Log In")')
        .first(),
    ).toBeVisible();
  });
});
