/**
 * Deterministic flight fixtures for eval and E2E runs, returned in place of a
 * live SerpApi call so tests stay reproducible and quota-free.
 */
import type { FlightSearchInput, FlightSearchOutcome } from '../flightsTool.js';

export function generateMockFlights(
  input: FlightSearchInput,
): FlightSearchOutcome {
  // Adversarial-eval fixture (Category H1): simulate the monthly SerpApi cap
  // so quota-exhaustion behavior is testable without burning real quota.
  if (process.env.EVAL_MOCK_QUOTA_EXHAUSTED === '1') {
    return {
      status: 'quota_exhausted',
      flights: [],
      message: 'monthly quota reached',
    };
  }

  const airlines = ['Delta', 'United', 'American'];
  const flights = airlines.map((airline, i) => ({
    offer_id: `mock-flight-${i}`,
    airline,
    airline_logo: null,
    flight_number: `${airline.slice(0, 2).toUpperCase()}${100 + i * 50}`,
    origin: input.origin,
    destination: input.destination,
    departure_time: `${input.departure_date}T${String(8 + i * 4).padStart(2, '0')}:00:00`,
    arrival_time: `${input.departure_date}T${String(14 + i * 4).padStart(2, '0')}:00:00`,
    price: 300 + i * 150,
    currency: 'USD',
    cabin_class: input.cabin_class ?? 'ECONOMY',
    segments: [
      {
        departure: {
          iataCode: input.origin,
          at: `${input.departure_date}T${String(8 + i * 4).padStart(2, '0')}:00:00`,
        },
        arrival: {
          iataCode: input.destination,
          at: `${input.departure_date}T${String(14 + i * 4).padStart(2, '0')}:00:00`,
        },
        carrierCode: airline.slice(0, 2).toUpperCase(),
        number: `${100 + i * 50}`,
      },
    ],
  }));
  return { status: 'ok', flights };
}
