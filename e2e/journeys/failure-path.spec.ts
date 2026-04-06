/**
 * Journey: failure path then recovery.
 *
 * Exercises US-12 -> US-10 -> retry -> US-9.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from '../fixtures/test-users';
import { login } from '../helpers/auth';

test('journey failure-path', async ({ page }) => {
  // US-12: protected route redirect.
  await page.goto('/trips');
  await expect(page).toHaveURL(/\/login/);

  // US-10: failed login.
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

  // US-9: retry with valid credentials.
  const user = await seedUser(newUser());
  await login(page, user);
  await expect(page).toHaveURL(/\/trips/);
});
