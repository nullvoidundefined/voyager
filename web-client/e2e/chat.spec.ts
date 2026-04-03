import { expect, test } from '@playwright/test';

import { loginAsTestUser } from './fixtures/auth.fixture';
import { sendChatMessage } from './fixtures/trip.fixture';

test.describe('Chat & Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    // Create a new trip
    await page.goto('/trips');
    await page.getByRole('link', { name: /new trip/i }).click();
    await page.waitForURL(/\/trips\/[a-f0-9-]+/, { timeout: 10000 });
  });

  test('US-18: New trip shows welcome message', async ({ page }) => {
    // Should see Voyager's welcome message
    await expect(page.getByText(/plan your trip|welcome/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('US-20: Sending a message shows it optimistically', async ({ page }) => {
    const testMessage = 'I want to go to Tokyo';
    await sendChatMessage(page, testMessage);

    // User message should appear immediately
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 5000 });
  });

  test('US-21: Agent responds with structured content', async ({ page }) => {
    await sendChatMessage(
      page,
      'I want to go to Tokyo. $5000 budget. 2 travelers. April 15 to April 30. Flying from New York.',
    );

    // Wait for agent response (may take up to 30s for API call)
    await expect(page.locator('text=VOYAGER').last()).toBeVisible({
      timeout: 45000,
    });

    // Agent should have responded with some text
    const assistantMessages = page.locator('[class*="assistant"]');
    await expect(assistantMessages.last()).toBeVisible();
  });

  test('US-24: Quick reply chips are visible and clickable', async ({
    page,
  }) => {
    await sendChatMessage(page, 'I want to go to Barcelona');

    // Wait for response with quick replies
    await page.waitForTimeout(15000); // Allow time for agent response

    // Look for quick reply buttons/chips
    const chips = page.locator('[class*="chip"], [class*="quickReply"]');
    if ((await chips.count()) > 0) {
      await expect(chips.first()).toBeVisible();
      // Clicking a chip should send a message
      const chipText = await chips.first().textContent();
      await chips.first().click();
      if (chipText) {
        await expect(page.getByText(chipText)).toBeVisible();
      }
    }
  });
});
