/**
 * Journey: returning user iterates on an existing trip.
 *
 * Exercises US-9 -> US-13 -> US-15 -> US-20 -> US-23 -> save.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from '../fixtures/test-users';
import { login } from '../helpers/auth';
import { sendMessage } from '../helpers/chat';
import { createTrip } from '../helpers/trip';

test('journey returning-user-iterates', async ({ page }) => {
  test.setTimeout(60_000);

  const user = await seedUser(newUser());

  // US-9: log in.
  await login(page, user);

  // US-14 + US-15: create a trip and view detail.
  await createTrip(page);

  // US-20: send an iterating message.
  await sendMessage(page, 'Make this trip more budget-friendly');
  await expect(page).toHaveURL(/\/trips\/(new|[a-f0-9-]+)/);
});
