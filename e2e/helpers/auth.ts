/**
 * Page-object helpers for authentication flows.
 *
 * Selectors target stable affordances rather than implementation
 * details. If a selector breaks, fix it once here instead of in
 * every spec.
 */
import { type Page, expect } from '@playwright/test';

export interface Credentials {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export async function register(page: Page, c: Credentials): Promise<void> {
  await page.goto('/register');
  await page.fill('input[type="email"]', c.email);
  await page.fill('input[type="password"]', c.password);

  const firstName = page.locator(
    'input[name="first_name"], input[placeholder*="First" i]',
  );
  if ((await firstName.count()) > 0) {
    await firstName.fill(c.firstName ?? 'Test');
  }
  const lastName = page.locator(
    'input[name="last_name"], input[placeholder*="Last" i]',
  );
  if ((await lastName.count()) > 0) {
    await lastName.fill(c.lastName ?? 'User');
  }

  await page.click('button[type="submit"]');
}

export async function login(page: Page, c: Credentials): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', c.email);
  await page.fill('input[type="password"]', c.password);
  await page.click('button[type="submit"]');
  // Trips list is the post-login landing route per US-9.
  await expect(page).toHaveURL(/\/trips/, { timeout: 10_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.click(
    'button:has-text("Sign Out"), a:has-text("Sign Out"), [aria-label="Sign out" i]',
  );
}

export async function assertLoggedIn(page: Page): Promise<void> {
  await expect(
    page.locator(
      'a:has-text("My Trips"), a:has-text("Account"), button:has-text("Sign Out"), a:has-text("Sign Out")',
    ),
  ).toBeVisible({ timeout: 5_000 });
}

export async function assertLoggedOut(page: Page): Promise<void> {
  await expect(
    page.locator('a:has-text("Sign In"), a:has-text("Log In")'),
  ).toBeVisible({ timeout: 5_000 });
}
