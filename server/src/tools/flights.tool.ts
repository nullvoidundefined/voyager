import { amadeusGet } from "app/services/amadeus.service.js";
import { cacheGet, cacheSet, normalizeCacheKey } from "app/services/cache.service.js";
import { logger } from "app/utils/logs/logger.js";

const CACHE_TTL = 3600; // 1 hour

export interface FlightSearchInput {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  passengers: number;
  max_price?: number;
  cabin_class?: string;
}

export interface FlightResult {
  offer_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  airline: string;
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

interface AmadeusFlightOffer {
  id: string;
  price: { total: string; currency: string };
  itineraries: Array<{
    segments: Array<{
      departure: { iataCode: string; at: string };
      arrival: { iataCode: string; at: string };
      carrierCode: string;
      number: string;
    }>;
  }>;
}

function normalizeOffer(offer: AmadeusFlightOffer): FlightResult {
  const firstSegment = offer.itineraries[0]?.segments[0];
  const lastSegment = offer.itineraries[0]?.segments[offer.itineraries[0].segments.length - 1];

  return {
    offer_id: offer.id,
    origin: firstSegment?.departure.iataCode ?? "",
    destination: lastSegment?.arrival.iataCode ?? "",
    departure_time: firstSegment?.departure.at ?? "",
    arrival_time: lastSegment?.arrival.at ?? "",
    airline: firstSegment?.carrierCode ?? "",
    flight_number: `${firstSegment?.carrierCode}${firstSegment?.number}`,
    price: parseFloat(offer.price.total),
    currency: offer.price.currency,
    cabin_class: null,
    segments: offer.itineraries[0]?.segments ?? [],
  };
}

export async function searchFlights(input: FlightSearchInput): Promise<FlightResult[]> {
  const cacheKey = normalizeCacheKey("amadeus", "flight-offers", {
    origin: input.origin,
    destination: input.destination,
    departureDate: input.departure_date,
    returnDate: input.return_date,
    adults: input.passengers,
    maxPrice: input.max_price,
    travelClass: input.cabin_class,
  });

  const cached = await cacheGet<FlightResult[]>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, "Flight search cache hit");
    return cached;
  }

  const params: Record<string, string | number | undefined> = {
    originLocationCode: input.origin,
    destinationLocationCode: input.destination,
    departureDate: input.departure_date,
    returnDate: input.return_date,
    adults: input.passengers,
    max: 5,
    maxPrice: input.max_price,
    travelClass: input.cabin_class,
  };

  const response = (await amadeusGet("/v2/shopping/flight-offers", params)) as {
    data: AmadeusFlightOffer[];
  };

  const results = (response.data || []).map(normalizeOffer).sort((a, b) => a.price - b.price);

  await cacheSet(cacheKey, results, CACHE_TTL);
  logger.info(
    { count: results.length, origin: input.origin, destination: input.destination },
    "Flight search complete",
  );

  return results;
}
