import {
  cacheGet,
  cacheSet,
  normalizeCacheKey,
} from 'app/services/cache.service.js';
import { serpApiGet } from 'app/services/serpapi.service.js';
import { logger } from 'app/utils/logs/logger.js';

const CACHE_TTL = 3600; // 1 hour

export interface FlightSearchInput {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  passengers: number;
  max_price?: number;
  cabin_class?: string;
  one_way?: boolean;
}

export interface FlightResult {
  offer_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  airline: string;
  airline_logo: string | null;
  flight_number: string;
  price: number;
  currency: string;
  cabin_class: string | null;
  segments: Array<{
    departure: { iataCode: string; at: string };
    arrival: { iataCode: string; at: string };
    carrierCode: string;
    number: string;
  }>;
}

interface SerpApiFlight {
  flights: Array<{
    departure_airport: { id: string; time: string };
    arrival_airport: { id: string; time: string };
    airline: string;
    airline_logo: string;
    flight_number: string;
  }>;
  total_duration: number;
  price: number;
  type: string;
}

interface SerpApiFlightsResponse {
  best_flights?: SerpApiFlight[];
  other_flights?: SerpApiFlight[];
  search_metadata?: { id: string };
  price_insights?: { lowest_price: number };
}

const CABIN_MAP: Record<string, number> = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 2,
  BUSINESS: 3,
  FIRST: 4,
};

function normalizeOffer(offer: SerpApiFlight, index: number): FlightResult {
  const firstLeg = offer.flights[0];
  const lastLeg = offer.flights[offer.flights.length - 1];

  return {
    offer_id: `serpapi-flight-${index}`,
    origin: firstLeg?.departure_airport.id ?? '',
    destination: lastLeg?.arrival_airport.id ?? '',
    departure_time: firstLeg?.departure_airport.time ?? '',
    arrival_time: lastLeg?.arrival_airport.time ?? '',
    airline: firstLeg?.airline ?? '',
    airline_logo: firstLeg?.airline_logo ?? null,
    flight_number: firstLeg?.flight_number ?? '',
    price: offer.price,
    currency: 'USD',
    cabin_class: null,
    segments: offer.flights.map((f) => ({
      departure: {
        iataCode: f.departure_airport.id,
        at: f.departure_airport.time,
      },
      arrival: { iataCode: f.arrival_airport.id, at: f.arrival_airport.time },
      carrierCode: f.airline,
      number: f.flight_number,
    })),
  };
}

export async function searchFlights(
  input: FlightSearchInput,
): Promise<FlightResult[]> {
  // Mock mode for eval runs
  if (process.env.EVAL_MOCK_SEARCH === 'true') {
    const airlines = ['Delta', 'United', 'American'];
    return airlines.map((airline, i) => ({
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
  }

  const cacheKey = normalizeCacheKey('serpapi', 'google-flights', {
    origin: input.origin,
    destination: input.destination,
    departureDate: input.departure_date,
    returnDate: input.return_date,
    adults: input.passengers,
    maxPrice: input.max_price,
    cabinClass: input.cabin_class,
    oneWay: input.one_way,
  });

  const cached = await cacheGet<FlightResult[]>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, 'Flight search cache hit');
    return cached;
  }

  const params: Record<string, string | number | undefined> = {
    departure_id: input.origin,
    arrival_id: input.destination,
    outbound_date: input.departure_date,
    return_date: input.one_way ? undefined : input.return_date,
    adults: input.passengers,
    travel_class: input.cabin_class ? CABIN_MAP[input.cabin_class] : undefined,
    currency: 'USD',
    hl: 'en',
    type: input.one_way ? '2' : undefined,
  };

  const response = (await serpApiGet(
    'google_flights',
    params,
  )) as SerpApiFlightsResponse;

  const allFlights = [
    ...(response.best_flights ?? []),
    ...(response.other_flights ?? []),
  ];

  let results = allFlights.map((f, i) => normalizeOffer(f, i));

  if (input.max_price) {
    results = results.filter((r) => r.price <= input.max_price!);
  }

  results = results.sort((a, b) => a.price - b.price).slice(0, 5);

  await cacheSet(cacheKey, results, CACHE_TTL);
  logger.info(
    {
      count: results.length,
      origin: input.origin,
      destination: input.destination,
    },
    'Flight search complete',
  );

  return results;
}
