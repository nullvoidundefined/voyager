/**
 * Page-object helpers for trip CRUD flows.
 */
import { type Page, expect } from '@playwright/test';

export async function createTrip(page: Page): Promise<void> {
  await page.goto('/trips');
  await page.click(
    'a:has-text("New Trip"), button:has-text("New Trip"), a:has-text("New trip"), button:has-text("New trip")',
  );
  // /trips/new is a redirect page: it POSTs a new trip then
  // router.replaces to /trips/{uuid}. Wait for the final URL
  // (which includes a UUID) rather than accepting /trips/new,
  // otherwise downstream test code that calls
  // extractTripId() on page.url() races the redirect and sees
  // /trips/new.
  await expect(page).toHaveURL(
    /\/trips\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/,
    { timeout: 15_000 },
  );
}

export async function loadTrip(page: Page, tripId: string): Promise<void> {
  await page.goto(`/trips/${tripId}`);
}

export async function saveTrip(page: Page): Promise<void> {
  await page.click(
    'button:has-text("Save itinerary"), button:has-text("Save Trip")',
  );
}

export async function deleteTrip(
  page: Page,
  tripId: string,
  opts: { confirm: boolean } = { confirm: true },
): Promise<void> {
  await page.goto('/trips');
  const card = page.locator(`[data-trip-id="${tripId}"]`);
  await card
    .locator('button:has-text("Delete"), [aria-label*="Delete" i]')
    .click();
  if (opts.confirm) {
    // UX-04 fix: Radix AlertDialog confirmation.
    await page
      .locator('[role="alertdialog"] button:has-text("Delete")')
      .click();
  }
}

export async function assertTripInList(
  page: Page,
  tripDestination: string,
): Promise<void> {
  await expect(page.locator(`text=${tripDestination}`).first()).toBeVisible({
    timeout: 5_000,
  });
}
