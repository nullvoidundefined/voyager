/**
 * Authentication: US-8 through US-12.
 *
 * Source of truth: docs/USER_STORIES.md.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { assertLoggedOut, login, logout, register } from './helpers/auth';

test.describe('Authentication', () => {
  test('US-8: register a new account (@fast)', async ({ page }) => {
    const user = newUser();
    await register(page, user);
    // AC: successful registration opens the Preferences Wizard.
    // The wizard renders IN PLACE on /register; the URL only
    // changes after the user closes the wizard. Assert the
    // wizard's H2 is visible instead of insisting on a URL change.
    // The register helper already waits for either the wizard or
    // a URL change, so by the time we get here at least one is
    // true.
    await expect(
      page.locator('h2:has-text("Your Travel Preferences")'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('US-9: log in (@fast)', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await expect(page).toHaveURL(/\/trips/);
  });

  test('US-10: failed login shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill(
      'input[type="email"]',
      'no-such-user@integration-test.invalid',
    );
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(
      page.locator('[role="alert"], .error, [class*="error" i]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('US-11: log out', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await logout(page);
    await expect(page).toHaveURL(/\/(login|$)/, { timeout: 5_000 });
    await assertLoggedOut(page);
  });

  test('US-12: protected route redirect', async ({ page }) => {
    await page.goto('/trips');
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });
});
