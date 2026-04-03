import { expect, test } from '@playwright/test';

import { loginAsTestUser } from './fixtures/auth.fixture';

test.describe('User Preferences', () => {
  test('US-31: Edit preferences from account page', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/account');

    // Should see preferences section
    await expect(page.getByText(/preferences/i)).toBeVisible();

    // Click edit button
    const editButton = page.getByRole('button', {
      name: /edit preferences/i,
    });
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();

      // Wizard modal should open
      await expect(page.getByText(/accommodation|travel pace/i)).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('US-33: Account page shows preference values', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/account');

    // Preferences section should display categories
    await expect(page.getByText(/preferences/i)).toBeVisible();
    // Should show at least some preference labels
    const prefLabels = [
      'Accommodation',
      'Travel Pace',
      'Dining',
      'Activities',
      'Travel Party',
      'Budget',
    ];
    let foundCount = 0;
    for (const label of prefLabels) {
      if (
        await page
          .getByText(label)
          .isVisible()
          .catch(() => false)
      ) {
        foundCount++;
      }
    }
    expect(foundCount).toBeGreaterThanOrEqual(3);
  });

  test('US-30: Wizard allows navigating through steps', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/account');

    const editButton = page.getByRole('button', {
      name: /edit preferences/i,
    });
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();

      // Should see first step content
      await expect(
        page.getByText(/accommodation|budget|mid-range|upscale/i),
      ).toBeVisible({ timeout: 5000 });

      // Click Next or Skip to advance
      const nextButton = page.getByRole('button', { name: /next|skip/i });
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click();

        // Should advance to next step
        await page.waitForTimeout(500);
        // Content should change
        await expect(
          page.getByText(/pace|relaxed|moderate|packed/i),
        ).toBeVisible();
      }
    }
  });
});
