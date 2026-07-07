/**
 * Checkout and booking confirmation: US-25 through US-28.
 *
 * Source of truth: docs/USER_STORIES.md.
 *
 * The BookingConfirmation dialog is opened via the BookingPrompt
 * component's "Save itinerary" chip, which renders automatically
 * when the trip has flights AND hotels AND status=planning.
 * Tests that need the dialog first seed flights+hotels via
 * seedTripSelections and reload so the prompt appears without
 * going through the full agent chat flow.
 */
import { expect, test } from '@playwright/test';

import { defaultSelections, seedTripSelections } from './fixtures/test-trips';
import { newUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';
import { createTrip } from './helpers/trip';

function extractTripId(url: string): string {
  const match = url.match(/\/trips\/([a-f0-9-]+)/i);
  if (!match?.[1]) {
    throw new Error(`Could not extract trip id from url: ${url}`);
  }
  return match[1];
}

test.describe('Checkout', () => {
  test('US-25: open booking confirmation modal', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    const tripId = extractTripId(page.url());
    // Seed flights+hotels so the BookingPrompt renders.
    await seedTripSelections(page, tripId, defaultSelections());
    await page.reload();
    // BookingPrompt shows "Save itinerary" automatically when
    // hasFlights && hasHotels && status=planning.
    const saveChip = page
      .getByRole('button', { name: 'Save itinerary' })
      .first();
    await expect(saveChip).toBeVisible({ timeout: 15_000 });
    await saveChip.click();
    // The modal renders TWO h2 elements with "Save Your Itinerary
    // for" text (one in the image overlay, one as the body title).
    // Use .first() to dodge strict-mode multi-match.
    await expect(
      page.getByRole('heading', { name: /Save Your Itinerary for/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('US-26: review itemized breakdown', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    const tripId = extractTripId(page.url());
    await seedTripSelections(page, tripId, defaultSelections());
    await page.reload();
    const saveChip = page
      .getByRole('button', { name: 'Save itinerary' })
      .first();
    await expect(saveChip).toBeVisible({ timeout: 15_000 });
    await saveChip.click();
    // Scope every assertion to the booking confirmation dialog
    // so "Flights" / "Hotels" headings do not collide with any
    // tile-group headings the chat area may also render.
    const dialog = page.getByRole('dialog', { name: 'Booking confirmation' });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(
      dialog.getByRole('heading', { name: 'Flights' }),
    ).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Hotels' })).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Car Rentals' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Experiences' }),
    ).toBeVisible();
    // The flight line item from defaultSelections() has airline
    // "Delta" and flight number "DL100". Verify the line item
    // text appears inside the dialog.
    await expect(dialog.getByText(/Delta DL100/i).first()).toBeVisible();
    // 2026-07-07 audit: assert the computed grand total equals the sum of the
    // seeded prices (flight 300 + hotel 660 + car 180 + experience 75 = 1215),
    // the exact surface a double-counted selection would become visible on.
    await expect(dialog.getByText('$1,215')).toBeVisible();
  });

  test('US-27: confirm and book the trip', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    const tripId = extractTripId(page.url());
    await seedTripSelections(page, tripId, defaultSelections());
    await page.reload();
    const saveChip = page
      .getByRole('button', { name: 'Save itinerary' })
      .first();
    await expect(saveChip).toBeVisible({ timeout: 15_000 });
    await saveChip.click();
    await expect(
      page.getByRole('heading', { name: /Save Your Itinerary for/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
    // Click the confirm button inside the dialog to trigger handleConfirmBooking.
    await page
      .getByRole('dialog', { name: 'Booking confirmation' })
      .getByRole('button', { name: 'Save itinerary' })
      .click();
    // Verify the trip status changed via the API.
    const resp = await page.request.get(
      `http://localhost:3001/trips/${tripId}`,
      { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    );
    expect(resp.status()).toBeLessThan(400);
    const body = (await resp.json()) as { trip: { status: string } };
    expect(body.trip.status).toBe('saved');
  });

  test('US-28: booked trip locked state', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    // Create a trip then PUT status=saved via the API to
    // simulate a completed booking. The chat input should
    // become disabled and show the locked placeholder.
    await createTrip(page);
    const tripId = extractTripId(page.url());
    // Use the page's request context so the session cookie is
    // included in the PUT.
    const putResponse = await page.request.put(
      `http://localhost:3001/trips/${tripId}`,
      {
        data: { status: 'saved' },
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      },
    );
    expect(putResponse.status()).toBeLessThan(400);

    // Reload the trip page so the status update propagates.
    await page.reload();
    const lockedPlaceholder = 'Itinerary saved! Enjoy your adventure.';
    await expect(
      page.locator(`input[aria-label="${lockedPlaceholder}"]`),
    ).toBeDisabled({ timeout: 10_000 });
  });
});
