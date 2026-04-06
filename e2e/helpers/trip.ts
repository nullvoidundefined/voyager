/**
 * Page-object helpers for trip CRUD flows.
 */
import { type Page, expect } from '@playwright/test';

export async function createTrip(page: Page): Promise<void> {
  await page.goto('/trips');
  await page.click(
    'a:has-text("New Trip"), button:has-text("New Trip"), a:has-text("New trip"), button:has-text("New trip")',
  );
  await expect(page).toHaveURL(/\/trips\/(new|[a-f0-9-]+)/, {
    timeout: 10_000,
  });
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
