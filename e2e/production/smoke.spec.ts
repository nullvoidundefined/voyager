/**
 * Production smoke suite. Runs against the live deployment.
 * Public-page tests run unconditionally. Authenticated tests require
 * SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD (skipped otherwise).
 * Run with: pnpm test:e2e:production
 */
import { expect, test } from '@playwright/test';

import { assertLoggedIn, login, logout } from '../helpers/auth';

const SMOKE_EMAIL = process.env.SMOKE_USER_EMAIL ?? '';
const SMOKE_PASSWORD = process.env.SMOKE_USER_PASSWORD ?? '';
const HAS_SMOKE_CREDS = Boolean(SMOKE_EMAIL && SMOKE_PASSWORD);

test.describe('public pages', () => {
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

  test('destinations API returns city data', async ({ page }) => {
    const response = await page.request.get(
      'https://server-production-f028.up.railway.app/destinations',
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(
      Array.isArray(body) ? body.length : Object.keys(body).length,
    ).toBeGreaterThan(10);
  });
});

test.describe('authenticated smoke', () => {
  test.beforeEach(async () => {
    if (!HAS_SMOKE_CREDS)
      test.skip(true, 'SMOKE_USER_EMAIL / SMOKE_USER_PASSWORD not set');
  });

  test('smoke user can log in and reach dashboard', async ({ page }) => {
    await login(page, { email: SMOKE_EMAIL, password: SMOKE_PASSWORD });
    await assertLoggedIn(page);
    await logout(page);
    await expect(page).toHaveURL(/\/(login|$)/, { timeout: 5_000 });
  });

  test('session persists across reload', async ({ page }) => {
    await login(page, { email: SMOKE_EMAIL, password: SMOKE_PASSWORD });
    await page.reload();
    await expect(page).toHaveURL(/\/trips/, { timeout: 10_000 });
    await assertLoggedIn(page);
    await logout(page);
  });

  test('trips page renders content shell after login', async ({ page }) => {
    await login(page, { email: SMOKE_EMAIL, password: SMOKE_PASSWORD });
    await expect(
      page
        .locator(
          'a:has-text("New Trip"), button:has-text("New Trip"), a:has-text("New trip"), button:has-text("New trip"), text=/No trips yet/i',
        )
        .first(),
    ).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('agent turn: trip creation and tile response', async ({ page }) => {
    test.setTimeout(180_000);

    await login(page, { email: SMOKE_EMAIL, password: SMOKE_PASSWORD });

    const tripCreated = page.waitForResponse(
      (res) =>
        res.url().includes('/trips') &&
        res.request().method() === 'POST' &&
        res.status() === 201,
      { timeout: 30_000 },
    );
    await page
      .locator(
        'a:has-text("New Trip"), button:has-text("New Trip"), a:has-text("New trip"), button:has-text("New trip")',
      )
      .first()
      .click();
    await tripCreated;
    await expect(page).toHaveURL(
      /\/trips\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/,
      { timeout: 15_000 },
    );

    const input = page
      .locator(
        'input[aria-label="Ask the agent to plan your trip..."], input[placeholder="Ask the agent to plan your trip..."]',
      )
      .first();
    await input.fill(
      'Plan a 3-day trip to Lisbon, June 20 to June 23, for 2 people, budget $2000. Flights from JFK.',
    );
    await page
      .locator('form')
      .filter({ has: input })
      .locator('button[type="submit"]')
      .first()
      .click();

    const startPlanning = page
      .locator('button:has-text("Start planning")')
      .first();
    try {
      await startPlanning.waitFor({ state: 'visible', timeout: 45_000 });
      await startPlanning.click();
    } catch {
      // Agent went straight to search without a plan-confirmation step.
    }

    const tileCard = page
      .locator('[data-tile-card="flight"], [data-tile-card="hotel"]')
      .first();
    await expect(tileCard).toBeVisible({ timeout: 120_000 });

    const ariaLabel = await tileCard.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).not.toMatch(/undefined/i);
    expect(ariaLabel).not.toMatch(/\bNaN\b/);
  });
});
