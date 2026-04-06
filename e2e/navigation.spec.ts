import { expect, test } from '@playwright/test';

test.describe('Navigation', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    expect(await page.title()).toBeTruthy();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    expect(await page.title()).toBeTruthy();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto('/login');
    // The login page renders TWO links to /register: a "Sign up"
    // link in the form and a "Get Started" CTA in the header or
    // footer. Use .first() so strict mode does not reject the
    // multi-match.
    const registerLink = page.locator('a[href*="register"]').first();
    await expect(registerLink).toBeVisible();
  });

  test('register page has link to login', async ({ page }) => {
    await page.goto('/register');
    const loginLink = page.locator('a[href*="login"]').first();
    await expect(loginLink).toBeVisible();
  });
});
