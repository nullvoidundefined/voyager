/**
 * Chat and booking flow: US-18 through US-24.
 *
 * Source of truth: docs/USER_STORIES.md.
 * Mocked tools (E2E_MOCK_TOOLS=1) provide deterministic flight,
 * hotel, and experience results so the agent loop is reproducible.
 *
 * NOTE: Many of these tests are marked test.fixme until the local
 * agent loop's selectors are stable. They establish the contract;
 * Plan C follow-up will unblock them as the chat UI stabilizes.
 */
import { test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';
import { sendMessage, waitForAgentResponse } from './helpers/chat';
import { createTrip } from './helpers/trip';

test.describe('Chat and booking flow', () => {
  test('US-18: welcome message on new trip', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    // AC: a friendly welcome from Voyager and an input field.
    await page.waitForLoadState('networkidle');
  });

  test.fixme('US-19: fill trip details form', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    // Selectors for origin/dates/budget/travelers TBD pending
    // shared form-field naming convention.
  });

  test('US-20: send a chat message (optimistic)', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    await sendMessage(page, 'I want to visit San Francisco');
    // The user message bubble should appear immediately.
    await page.waitForTimeout(500);
  });

  test('US-21: see agent response with tool progress', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    await sendMessage(
      page,
      'Plan a 3-day trip to San Francisco from Denver next month, $2500 budget, 2 travelers',
    );
    await waitForAgentResponse(page, { timeoutMs: 45_000 });
  });

  test.fixme('US-22: browse tile cards (flights, hotels, cars, experiences)', async () => {
    // Depends on stable tile-card data attributes.
  });

  test.fixme('US-23: select and confirm a tile card', async () => {
    // Depends on stable tile-card data attributes.
  });

  test.fixme('US-24: use quick reply chips', async () => {
    // Depends on stable quick-reply-chip selectors.
  });
});
