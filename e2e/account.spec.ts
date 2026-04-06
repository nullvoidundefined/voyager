/**
 * Account: US-34 and US-35.
 *
 * Source of truth: docs/USER_STORIES.md.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';

test.describe('Account', () => {
  test('US-34: view account details', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await page.goto('/account');
    await expect(page.locator(`text=${user.email}`).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('US-35: view preference completion status', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await page.goto('/account');
    await expect(
      page.locator('text=/[0-9]+ of [0-9]+ categor/i').first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
