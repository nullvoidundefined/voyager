import { expect, test } from '@playwright/test';

test.describe('Public Pages', () => {
  test('US-1: Home page shows hero, features, demo chat, and CTAs', async ({
    page,
  }) => {
    await page.goto('/');

    // Hero section with headline
    await expect(
      page.getByRole('heading', { name: /next journey|adventure/i }),
    ).toBeVisible();

    // Features section
    await expect(page.getByText('Real Flights')).toBeVisible();
    await expect(page.getByText('Curated Hotels')).toBeVisible();

    // Demo chat (MockChatBox)
    await expect(page.getByText(/live demo/i)).toBeVisible();

    // CTAs
    await expect(
      page.getByRole('link', { name: /get started|sign up/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /discover destinations/i }),
    ).toBeVisible();
  });

  test('US-6: FAQ page loads and shows questions', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.getByRole('heading', { name: /faq/i })).toBeVisible();
    // At least one question is visible
    await expect(
      page.locator('details, [role="button"]').first(),
    ).toBeVisible();
  });

  test('US-7: Public nav shows Explore, FAQ, and Sign In', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Explore' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'FAQ' })).toBeVisible();
    await expect(header.getByRole('link', { name: /sign in/i })).toBeVisible();
  });
});
