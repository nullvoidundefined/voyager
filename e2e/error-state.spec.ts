/**
 * An agent error mid-conversation must not hang the turn (2026-07-07 E2E audit;
 * the F-03 crash class had zero end-to-end coverage).
 *
 * When the agent loop throws, the upstream breaker/orchestrator degrades the
 * turn gracefully rather than crashing. The guarantee that matters end-to-end is
 * that the UI recovers: the input becomes usable again and the "Thinking"
 * spinner clears, instead of hanging. The mock agent throws on a per-message
 * marker, so this needs no global scenario switch and cannot race parallel
 * workers.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';
import { sendMessage } from './helpers/chat';
import { createTrip } from './helpers/trip';

test('an agent error does not hang the turn: input recovers and the spinner clears', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const user = await seedUser(newUser());
  await login(page, user);
  await createTrip(page);

  await sendMessage(page, '__e2e_force_error__');

  // The core guarantee: an agent error must not hang the turn. Whether the
  // client surfaces a Toast or degrades gracefully, the input must return to a
  // usable state rather than stay stuck behind the "Thinking" spinner.
  const chatInput = page
    .locator('input[placeholder*="Ask the agent" i]')
    .first();
  await expect(chatInput).toBeEnabled({ timeout: 30_000 });
  // And the persistent loading indicator must clear (no stuck spinner).
  await expect(page.getByText(/Thinking\.\.\./)).toHaveCount(0, {
    timeout: 30_000,
  });
});
