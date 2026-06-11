/**
 * Production smoke suite. Runs against the live deployment.
 * Public-pages tests run unconditionally. The auth test requires
 * SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD to be set (skipped otherwise).
 * Run with: pnpm test:e2e:production
 */
import { expect, test } from '@playwright/test';

import { assertLoggedIn, login, logout } from '../helpers/auth';

test.describe('Production smoke', () => {
  test('home page loads with primary CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.locator('a:has-text("Get Started"), a:has-text("Sign Up")').first(),
    ).toBeVisible();
  });

  test('explore page loads destination cards', async ({ page }) => {
    await page.goto('/explore');
    const cards = page.locator(
      '[data-destination-card], article a[href^="/explore/"]',
    );
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(20);
  });

  test('destination guide loads', async ({ page }) => {
    await page.goto('/explore');
    const firstCard = page.locator('a[href^="/explore/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/explore\/[a-z0-9-]+/, { timeout: 10_000 });
    await expect(
      page
        .locator('button, a')
        .filter({ hasText: /Plan a trip/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('FAQ page loads', async ({ page }) => {
    await page.goto('/faq');
    await expect(page).toHaveURL(/\/faq/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.locator('input[type="email"], input[name="email"]').first(),
    ).toBeVisible();
  });

  test('protected route redirects to login', async ({ page }) => {
    await page.goto('/trips');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('auth: smoke user can log in and reach dashboard', async ({ page }) => {
    const email = process.env.SMOKE_USER_EMAIL;
    const password = process.env.SMOKE_USER_PASSWORD;
    if (!email || !password) {
      test.skip(true, 'SMOKE_USER_EMAIL / SMOKE_USER_PASSWORD not set');
      return;
    }
    await login(page, { email, password });
    await assertLoggedIn(page);
    await logout(page);
    await expect(page).toHaveURL(/\/(login|$)/, { timeout: 5_000 });
  });
});
