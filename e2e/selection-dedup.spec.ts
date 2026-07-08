/**
 * Selection dedup across format-divergent writers (2026-07-07 E2E audit).
 *
 * The 2026-07-06 duplicate-flight incident: the tile-click POST wrote a flight
 * with clean airline/flight_number and a "YYYY-MM-DD HH:MM" departure, while the
 * agent's select_flight wrote the SAME flight with a paraphrased airline
 * ("American + Etihad"), a paraphrased flight_number ("AA 2614 / EY 12"), and an
 * ISO departure. The two produced different selection_keys, so the flight
 * persisted twice and the budget double-counted it.
 *
 * Every other selection E2E seeds via the test-only /test-selections backdoor,
 * bypassing dedup entirely. This drives the real public POST /trips/:id/selections
 * endpoint twice with the exact captured payloads and asserts a single row and a
 * single-counted budget.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';
import { createTrip } from './helpers/trip';

const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:3001';

function extractTripId(url: string): string {
  const match = url.match(/\/trips\/([a-f0-9-]+)/i);
  if (!match?.[1]) {
    throw new Error(`Could not extract trip id from url: ${url}`);
  }
  return match[1];
}

// Captured from production tool_call_log (conversation d0c7419a): the same
// SFO -> AUH flight as the tile writer and the agent writer would each submit it.
const TILE_FLIGHT = {
  airline: 'American',
  flight_number: 'AA 2614',
  origin: 'SFO',
  destination: 'AUH',
  departure_time: '2026-07-08 06:04',
  price: 1186,
  currency: 'USD',
};
// The agent's "+"/"/" phrasing is rejected by the punctuation allowlist, so in
// the real incident it retried with "and"/"-" and THAT is the row that
// duplicated. Use the format that actually persisted.
const AGENT_FLIGHT = {
  airline: 'American and Etihad',
  flight_number: 'AA 2614 - EY 12',
  origin: 'SFO',
  destination: 'AUH',
  departure_time: '2026-07-08T06:04:00',
  price: 1186,
  currency: 'USD',
};

test('a flight selected by both writers dedupes to one row and one budget line', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const user = await seedUser(newUser());
  await login(page, user);
  await createTrip(page);
  const tripId = extractTripId(page.url());

  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  // Tile-click writer, then the agent-paraphrased writer, both real POSTs.
  const first = await page.request.post(
    `${API_BASE}/trips/${tripId}/selections`,
    { data: { type: 'flight', data: TILE_FLIGHT }, headers },
  );
  expect(first.status()).toBeLessThan(400);
  const second = await page.request.post(
    `${API_BASE}/trips/${tripId}/selections`,
    { data: { type: 'flight', data: AGENT_FLIGHT }, headers },
  );
  expect(second.status()).toBeLessThan(400);

  const tripResp = await page.request.get(`${API_BASE}/trips/${tripId}`, {
    headers,
  });
  expect(tripResp.status()).toBeLessThan(400);
  const body = (await tripResp.json()) as {
    trip: { flights: Array<{ price: number | string }> };
  };

  // One physical flight, selected by two format-divergent writers, is one row,
  // so the budget counts $1,186 once, not $2,372.
  expect(body.trip.flights).toHaveLength(1);
  expect(Number(body.trip.flights[0]?.price)).toBe(1186);
});
