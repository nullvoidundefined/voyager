import { expect, test } from '@playwright/test';

import { loginAsTestUser } from './fixtures/auth.fixture';

test.describe('Account Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('US-34: Account page shows user details', async ({ page }) => {
    await page.goto('/account');

    // Should show account heading
    await expect(page.getByRole('heading', { name: /account/i })).toBeVisible();

    // Should show email or name
    await expect(page.getByText(/@|test|user/i)).toBeVisible();
  });

  test('US-35: Account page shows preference completion status', async ({
    page,
  }) => {
    await page.goto('/account');

    // Should show completion status
    await expect(
      page.getByText(/categories completed|preferences/i),
    ).toBeVisible();
  });
});
