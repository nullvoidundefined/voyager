/**
 * Test-side mirror of the server's SerpApi mock layer.
 *
 * The actual swap happens in server/src/tools/mock/*. When
 * E2E_MOCK_TOOLS=1 is set, the server's flight and hotel tools
 * return deterministic data instead of calling SerpApi.
 *
 * This file documents what those mocks emit so that Playwright
 * tests can assert on the expected text without scraping the
 * server fixture files. If the server mock changes, update
 * the constants here in lockstep.
 */

export type SerpApiScenario = 'happy' | 'empty' | 'ratelimit';

export interface MockFlight {
  offerId: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  price: number;
  currency: 'USD';
}

export interface MockHotel {
  offerId: string;
  name: string;
  pricePerNight: number;
  totalPrice: number;
  starRating: number;
  currency: 'USD';
}

const HAPPY_FLIGHTS_DEN_SFO: MockFlight[] = [
  {
    offerId: 'mock-flight-0',
    airline: 'Delta',
    flightNumber: 'DE100',
    origin: 'DEN',
    destination: 'SFO',
    price: 300,
    currency: 'USD',
  },
  {
    offerId: 'mock-flight-1',
    airline: 'United',
    flightNumber: 'UN150',
    origin: 'DEN',
    destination: 'SFO',
    price: 450,
    currency: 'USD',
  },
  {
    offerId: 'mock-flight-2',
    airline: 'American',
    flightNumber: 'AM200',
    origin: 'DEN',
    destination: 'SFO',
    price: 600,
    currency: 'USD',
  },
];

const HAPPY_HOTELS_SF: MockHotel[] = [
  {
    offerId: 'mock-hotel-0',
    name: 'Test Boutique Hotel',
    pricePerNight: 220,
    totalPrice: 660,
    starRating: 4,
    currency: 'USD',
  },
  {
    offerId: 'mock-hotel-1',
    name: 'Test Mid-Range Inn',
    pricePerNight: 150,
    totalPrice: 450,
    starRating: 3,
    currency: 'USD',
  },
  {
    offerId: 'mock-hotel-2',
    name: 'Test Luxury Suites',
    pricePerNight: 450,
    totalPrice: 1350,
    starRating: 5,
    currency: 'USD',
  },
];

export interface MockSerpApiBundle {
  flights: MockFlight[];
  hotels: MockHotel[];
  rateLimited: boolean;
}

export function getMockSerpApi(scenario: SerpApiScenario): MockSerpApiBundle {
  switch (scenario) {
    case 'happy':
      return {
        flights: HAPPY_FLIGHTS_DEN_SFO,
        hotels: HAPPY_HOTELS_SF,
        rateLimited: false,
      };
    case 'empty':
      return { flights: [], hotels: [], rateLimited: false };
    case 'ratelimit':
      return { flights: [], hotels: [], rateLimited: true };
  }
}
