/**
 * Deterministic flight fixtures for eval and E2E runs, returned in place of a
 * live SerpApi call so tests stay reproducible and quota-free.
 */
import type { FlightSearchInput, FlightSearchOutcome } from '../flightsTool.js';

const AIRLINE_CODE_LENGTH = 2;
const FLIGHT_NUMBER_BASE = 100;
const FLIGHT_NUMBER_STEP = 50;
const DEPARTURE_BASE_HOUR = 8;
const ARRIVAL_BASE_HOUR = 14;
const HOURS_BETWEEN_OPTIONS = 4;
const BASE_PRICE_USD = 300;
const PRICE_STEP_USD = 150;

export function generateMockFlights(
  input: FlightSearchInput,
): FlightSearchOutcome {
  // Adversarial-eval fixture (Category H1): simulate the monthly SerpApi cap
  // so quota-exhaustion behavior is testable without burning real quota.
  if (process.env.EVAL_MOCK_QUOTA_EXHAUSTED === '1') {
    return {
      flights: [],
      message: 'monthly quota reached',
      status: 'quota_exhausted',
    };
  }

  const airlines = ['Delta', 'United', 'American'];
  const flights = airlines.map((airline, i) => ({
    airline,
    airline_logo: null,
    arrival_time: `${input.departure_date}T${String(ARRIVAL_BASE_HOUR + i * HOURS_BETWEEN_OPTIONS).padStart(AIRLINE_CODE_LENGTH, '0')}:00:00`,
    cabin_class: input.cabin_class ?? 'ECONOMY',
    currency: 'USD',
    departure_time: `${input.departure_date}T${String(DEPARTURE_BASE_HOUR + i * HOURS_BETWEEN_OPTIONS).padStart(AIRLINE_CODE_LENGTH, '0')}:00:00`,
    destination: input.destination,
    flight_number: `${airline.slice(0, AIRLINE_CODE_LENGTH).toUpperCase()}${FLIGHT_NUMBER_BASE + i * FLIGHT_NUMBER_STEP}`,
    offer_id: `mock-flight-${i}`,
    origin: input.origin,
    price: BASE_PRICE_USD + i * PRICE_STEP_USD,
    segments: [
      {
        arrival: {
          at: `${input.departure_date}T${String(ARRIVAL_BASE_HOUR + i * HOURS_BETWEEN_OPTIONS).padStart(AIRLINE_CODE_LENGTH, '0')}:00:00`,
          iataCode: input.destination,
        },
        carrierCode: airline.slice(0, AIRLINE_CODE_LENGTH).toUpperCase(),
        departure: {
          at: `${input.departure_date}T${String(DEPARTURE_BASE_HOUR + i * HOURS_BETWEEN_OPTIONS).padStart(AIRLINE_CODE_LENGTH, '0')}:00:00`,
          iataCode: input.origin,
        },
        number: `${FLIGHT_NUMBER_BASE + i * FLIGHT_NUMBER_STEP}`,
      },
    ],
  }));
  return { flights, status: 'ok' };
}
