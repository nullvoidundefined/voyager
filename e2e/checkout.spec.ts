/**
 * Checkout and booking confirmation: US-25 through US-28.
 *
 * Source of truth: docs/USER_STORIES.md.
 */
import { test } from '@playwright/test';

test.describe('Checkout', () => {
  test.fixme('US-25: open booking confirmation modal', async () => {
    // Depends on the chat agent reaching the "ready to book"
    // state with all categories selected. Will unblock once the
    // chat-booking-flow tests are stable.
  });

  test.fixme('US-26: review itemized breakdown', async () => {
    // Asserts the BookingConfirmation modal renders flight + hotel
    // + experience + car-rental line items with totals.
  });

  test.fixme('US-27: confirm and book the trip', async () => {
    // Asserts that clicking Confirm transitions the trip to
    // status "saved" and shows the success state.
  });

  test.fixme('US-28: booked trip locked state', async () => {
    // Asserts the chat input is disabled and the "Booked" badge
    // is visible after a trip is confirmed.
  });
});
