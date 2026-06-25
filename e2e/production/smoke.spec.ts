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
        .locator('a:has-text("New Trip"), button:has-text("New Trip")')
        .or(page.getByText(/No trips yet/i))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  // The agent-turn tile-response assertion lives in the mocked e2e lane
  // (chat-booking-flow.spec.ts US-22, E2E_MOCK_TOOLS=1), where flight/hotel
  // tiles are deterministic. It is intentionally not duplicated here: against
  // the live deployment it depended on real SerpApi results and burned the
  // 250/month quota on every deploy, which is what made this gate flaky.

  test('trip persists across sessions: appears in list after navigation and reload', async ({
    page,
  }) => {
    test.setTimeout(210_000);

    await login(page, { email: SMOKE_EMAIL, password: SMOKE_PASSWORD });

    // Create a new trip
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
    const createdResponse = await tripCreated;
    const tripBody = (await createdResponse.json().catch(() => ({}))) as {
      id?: string;
      trip?: { id?: string };
    };
    const tripId = tripBody.trip?.id ?? tripBody.id;

    await expect(page).toHaveURL(
      /\/trips\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/,
      { timeout: 15_000 },
    );

    // Persistence is established by trip creation (POST /trips) alone; the
    // list assertion below keys off the created tripId. We intentionally do not
    // send an agent message here, so this test does not drive a live SerpApi
    // search (that path is covered, mocked, in the e2e fast lane).

    // Navigate to the trips list
    await page.goto('/trips');
    await expect(page).toHaveURL(/\/trips$/, { timeout: 10_000 });

    // Trip must appear in the list (by URL id or link text)
    const tripLink = tripId
      ? page.locator(`a[href*="${tripId}"]`).first()
      : page.locator('a[href*="/trips/"]').first();
    await expect(tripLink).toBeVisible({ timeout: 15_000 });

    // Reload the page and confirm the trip is still there
    await page.reload();
    await expect(page).toHaveURL(/\/trips$/, { timeout: 10_000 });
    await expect(tripLink).toBeVisible({ timeout: 10_000 });

    await logout(page);
  });
});
