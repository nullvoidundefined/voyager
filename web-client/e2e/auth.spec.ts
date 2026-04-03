import { expect, test } from '@playwright/test';

import {
  TEST_EMAIL,
  TEST_PASSWORD,
  ensureLoggedOut,
  generateTestEmail,
  loginAsTestUser,
} from './fixtures/auth.fixture';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('US-9: Login with valid credentials redirects to trips', async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL('/trips');
    await expect(
      page.getByRole('heading', { name: /my trips/i }),
    ).toBeVisible();
  });

  test('US-10: Login with invalid credentials shows error', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('wrong@example.com');
    await page.getByPlaceholder('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Error message should appear
    await expect(
      page.getByText(/invalid|incorrect|authentication/i),
    ).toBeVisible({ timeout: 5000 });
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('US-8: Register creates account and opens preferences wizard', async ({
    page,
  }) => {
    const email = generateTestEmail();
    await page.goto('/register');

    // Fill registration form
    await page.getByPlaceholder(/first name/i).fill('Test');
    await page.getByPlaceholder(/last name/i).fill('User');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign up|create account/i }).click();

    // Preferences wizard should appear
    await expect(
      page.getByText(/accommodation|travel pace|preferences/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('US-11: Logout redirects to home and shows Sign In', async ({
    page,
  }) => {
    await loginAsTestUser(page);

    // Click logout
    await page.getByRole('button', { name: /sign out|logout/i }).click();

    // Should redirect to home or login
    await page.waitForURL(/^\/($|login)/);

    // Sign In link should be visible again
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('US-12: Unauthenticated access to /trips redirects to /login', async ({
    page,
  }) => {
    await page.goto('/trips');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});
