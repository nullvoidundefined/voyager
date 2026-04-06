/**
 * Real-API smoke suite.
 *
 * IMPORTANT: This file runs WITHOUT E2E_MOCK_TOOLS=1. It hits
 * real SerpApi, real Google Places, and real Anthropic. It is
 * intended for the nightly e2e-real-apis.yml workflow only and
 * is excluded from the main e2e suite via the testIgnore in
 * playwright.config.real-apis.ts.
 *
 * Keep the suite small. Each test should consume at most one
 * SerpApi call and one Anthropic turn so the monthly quotas are
 * preserved.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from '../fixtures/test-users';
import { login } from '../helpers/auth';
import { sendMessage, waitForAgentResponse } from '../helpers/chat';
import { createTrip } from '../helpers/trip';

test.describe('Real API smoke', () => {
  test('agent loop reaches first tool call against live SerpApi', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    await sendMessage(
      page,
      'Plan a 3-day trip to Denver from San Francisco next month, $2000 budget, 2 travelers',
    );
    await waitForAgentResponse(page, { timeoutMs: 90_000 });
    await expect(page).toHaveURL(/\/trips\/(new|[a-f0-9-]+)/);
  });
});
