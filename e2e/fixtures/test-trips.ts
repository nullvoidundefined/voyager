/**
 * Trip fixture helpers for e2e tests that need a trip with
 * pre-seeded selections.
 *
 * Source: ENG-17. US-23, US-26, and US-27 all need the trip
 * record to have flights / hotels / car rentals / experiences
 * populated BEFORE the test runs. Going through the real chat
 * flow would require a multi-turn MockAnthropic state machine
 * and would couple the tests to the agent loop. The server
 * exposes a gated POST /trips/:id/test-selections endpoint
 * that inserts selections directly via the existing repo
 * functions. This helper is the client for that endpoint.
 *
 * The endpoint is only active when E2E_BYPASS_RATE_LIMITS=1 is
 * set, which the Playwright config already does.
 */
import type { Page } from '@playwright/test';

const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:3001';

export interface TripSelectionInput {
  flights?: Array<{
    airline: string;
    flight_number: string;
    origin: string;
    destination: string;
    departure_time?: string;
    arrival_time?: string;
    price: number;
    currency: string;
  }>;
  hotels?: Array<{
    name: string;
    city?: string;
    star_rating?: number;
    price_per_night: number;
    total_price: number;
    currency: string;
    check_in?: string;
    check_out?: string;
  }>;
  car_rentals?: Array<{
    provider: string;
    car_name: string;
    car_type?: string;
    price_per_day?: number;
    total_price: number;
    currency: string;
  }>;
  experiences?: Array<{
    name: string;
    category?: string;
    estimated_cost: number;
    rating?: number;
  }>;
}

/**
 * Insert pre-selected flights / hotels / car rentals /
 * experiences into a trip via the test-only endpoint. The
 * page's request context is used so the session cookie is
 * included automatically.
 *
 * Throws if the endpoint is not reachable or returns a
 * non-2xx status. Do not call this unless you know the trip
 * exists and the caller owns it (i.e., after `login` and
 * `createTrip`).
 */
export async function seedTripSelections(
  page: Page,
  tripId: string,
  selections: TripSelectionInput,
): Promise<void> {
  const response = await page.request.post(
    `${API_BASE}/trips/${tripId}/test-selections`,
    {
      data: selections,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    },
  );
  if (response.status() >= 400) {
    const body = await response.text().catch(() => '');
    throw new Error(`seedTripSelections failed: ${response.status()} ${body}`);
  }
}

/**
 * A canonical "happy path" selection payload matching the
 * shape the real agent loop would produce for a DEN -> SFO
 * round trip. Tests can use this as-is or spread additional
 * fields on top.
 */
export function defaultSelections(): TripSelectionInput {
  return {
    flights: [
      {
        airline: 'Delta',
        flight_number: 'DL100',
        origin: 'DEN',
        destination: 'SFO',
        departure_time: '2026-06-01T08:00:00',
        arrival_time: '2026-06-01T10:00:00',
        price: 300,
        currency: 'USD',
      },
    ],
    hotels: [
      {
        name: 'Test Boutique Hotel',
        city: 'San Francisco',
        star_rating: 4,
        price_per_night: 220,
        total_price: 660,
        currency: 'USD',
        check_in: '2026-06-01',
        check_out: '2026-06-04',
      },
    ],
    car_rentals: [
      {
        provider: 'Hertz',
        car_name: 'Toyota Camry',
        car_type: 'midsize',
        price_per_day: 60,
        total_price: 180,
        currency: 'USD',
      },
    ],
    experiences: [
      {
        name: 'Bay Cruise',
        category: 'tour',
        estimated_cost: 75,
        rating: 4.5,
      },
    ],
  };
}
