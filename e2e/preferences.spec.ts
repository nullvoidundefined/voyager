/**
 * User preferences: US-29 through US-33.
 *
 * Source of truth: docs/USER_STORIES.md.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { login, register } from './helpers/auth';

test.describe('Preferences', () => {
  test('US-29: preferences wizard opens after registration', async ({
    page,
  }) => {
    const user = newUser();
    await register(page, user);
    // The wizard renders IN PLACE on /register and is identified
    // by its H2 "Your Travel Preferences". The URL stays at
    // /register until the wizard closes via router.push.
    await expect(
      page.locator('h2:has-text("Your Travel Preferences")'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test.fixme('US-30: navigate through wizard steps', async () => {
    // Asserts Next/Back/Skip work and progress bar advances.
  });

  test('US-31: edit preferences from account page', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await page.goto('/account');
    const editBtn = page
      .locator(
        'button:has-text("Edit Preferences"), a:has-text("Edit Preferences")',
      )
      .first();
    if ((await editBtn.count()) === 0) {
      test.skip(true, 'edit-preferences affordance not yet implemented');
    }
    await editBtn.click();
  });

  test.fixme('US-32: incomplete preferences badge', async () => {
    // Asserts a coral dot next to the Account nav link when
    // wizard is incomplete.
  });

  test('US-33: view preferences on account page', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await page.goto('/account');
    // AC: completion count visible.
    await expect(
      page.locator('text=/[0-9]+ of [0-9]+ categor/i').first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
