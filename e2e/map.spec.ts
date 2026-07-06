import { expect, test } from '@playwright/test';

import { seedTripSelections } from './fixtures/test-trips';
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

test('trip detail page renders the map container', async ({ page }) => {
  const user = await seedUser(newUser());
  await login(page, user);
  await createTrip(page);
  await expect(page.locator('[data-testid="trip-map"]')).toBeVisible({
    timeout: 10_000,
  });
});

// 2026-07-07 Iloilo-City incident: airport pins were built by free-text
// Mapbox geocoding of "<IATA> airport" strings, which matched a Philippine
// neighborhood named "Airport" and centered an Abu Dhabi trip's map on
// Iloilo City. Airport pins must resolve through the backend IATA endpoint
// with real coordinates; the Mapbox geocoder must never see airport codes.
test('flight airport pins resolve through the backend IATA endpoint, never free-text geocoding', async ({
  page,
}) => {
  test.setTimeout(60_000);

  const mapboxRequests: string[] = [];
  await page.route('**/api.mapbox.com/**', async (route) => {
    mapboxRequests.push(route.request().url());
    await route.fulfill({
      body: JSON.stringify({ features: [] }),
      contentType: 'application/json',
    });
  });

  const user = await seedUser(newUser());
  await login(page, user);
  await createTrip(page);
  const tripId = extractTripId(page.url());
  await seedTripSelections(page, tripId, {
    flights: [
      {
        airline: 'Etihad',
        currency: 'USD',
        departure_time: '2026-07-08T06:04:00',
        destination: 'AUH',
        flight_number: 'EY 12',
        origin: 'SFO',
        price: 1186,
      },
    ],
  });

  const airportLookup = page.waitForResponse(
    (res) => res.url().includes('/places/airport/AUH') && res.ok(),
    { timeout: 15_000 },
  );
  await page.reload();

  const response = await airportLookup;
  const airport = (await response.json()) as { lat: number; lon: number };
  // Abu Dhabi, not Iloilo City (10.7, 122.5) or anywhere else.
  expect(airport.lat).toBeCloseTo(24.4539, 2);
  expect(airport.lon).toBeCloseTo(54.3773, 2);

  const airportGeocodeCalls = mapboxRequests.filter((url) =>
    url.toLowerCase().includes('airport'),
  );
  expect(airportGeocodeCalls).toHaveLength(0);
});
