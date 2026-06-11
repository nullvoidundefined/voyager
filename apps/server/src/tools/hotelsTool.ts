import {
  cacheGet,
  cacheSet,
  normalizeCacheKey,
} from 'app/services/cache/cacheService.js';
import {
  SerpApiQuotaExceededError,
  serpApiGet,
} from 'app/services/external/serpapiService.js';
import { generateMockHotels } from 'app/tools/mock/hotelsMock.js';
import { isMockMode } from 'app/tools/mock/isMockMode.js';
import { logger } from 'app/utils/logs/logger.js';

// FIN-07: extended from 1h to 6h on 2026-04-06. See flightsTool.ts
// for rationale. Hotel prices are even less volatile than flights.
const CACHE_TTL = 21600; // 6 hours

export interface HotelSearchInput {
  city: string;
  check_in: string;
  check_out: string;
  guests: number;
  star_rating_min?: number;
  max_price_per_night?: number;
}

// F-17: distinct outcome shape so the agent can narrate the correct
// user-facing message instead of generic "no hotels found" for every
// failure mode (timeout, quota exhausted, upstream error).
export type HotelSearchStatus =
  | 'ok'
  | 'no_results'
  | 'timeout'
  | 'quota_exhausted'
  | 'error';

export interface HotelSearchOutcome {
  status: HotelSearchStatus;
  hotels: HotelResult[];
  message?: string;
}

export interface HotelResult {
  hotel_id: string;
  offer_id: string;
  name: string;
  address: string;
  city: string;
  star_rating: number;
  total_price: number;
  price_per_night: number;
  currency: string;
  check_in: string;
  check_out: string;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SerpApiHotel {
  name: string;
  overall_rating: number;
  hotel_class: number | string;
  rate_per_night?: { lowest: string; extracted_lowest: number };
  total_rate?: { lowest: string; extracted_lowest: number };
  nearby_places?: Array<{ name: string }>;
  gps_coordinates?: { latitude: number; longitude: number };
  check_in_time?: string;
  check_out_time?: string;
  link?: string;
  images?: Array<{ thumbnail: string; original_image?: string }>;
}

interface SerpApiHotelsResponse {
  properties?: SerpApiHotel[];
  search_metadata?: { id: string };
}

function parseStarRating(hotelClass: number | string | undefined): number {
  if (typeof hotelClass === 'number') return hotelClass;
  if (typeof hotelClass === 'string') {
    const match = hotelClass.match(/(\d)/);
    return match ? Number(match[1]) : 0;
  }
  return 0;
}

// SerpApi's google_hotels properties array does not include a street
// address. The closest signal is nearby_places[0].name (a landmark).
// Falling back to the city keeps the field non-empty for the UI.
function formatHotelAddress(entry: SerpApiHotel, city: string): string {
  const landmark = entry.nearby_places?.[0]?.name;
  return landmark ? `Near ${landmark}, ${city}` : city;
}

function normalizeHotel(
  entry: SerpApiHotel,
  index: number,
  input: HotelSearchInput,
): HotelResult {
  return {
    hotel_id: `serpapi-hotel-${index}`,
    offer_id: `serpapi-hotel-offer-${index}`,
    name: entry.name,
    address: formatHotelAddress(entry, input.city),
    city: input.city,
    star_rating: parseStarRating(entry.hotel_class),
    total_price:
      entry.total_rate?.extracted_lowest ??
      entry.rate_per_night?.extracted_lowest ??
      0,
    price_per_night: entry.rate_per_night?.extracted_lowest ?? 0,
    currency: 'USD',
    check_in: input.check_in,
    check_out: input.check_out,
    image_url: entry.images?.[0]?.thumbnail ?? null,
    latitude: entry.gps_coordinates?.latitude ?? null,
    longitude: entry.gps_coordinates?.longitude ?? null,
  };
}

export async function searchHotels(
  input: HotelSearchInput,
): Promise<HotelSearchOutcome> {
  // Mock mode for eval runs
  if (isMockMode()) {
    return generateMockHotels(input);
  }

  const cacheKey = normalizeCacheKey('serpapi', 'google-hotels', {
    city: input.city,
    checkIn: input.check_in,
    checkOut: input.check_out,
    guests: input.guests,
    starRatingMin: input.star_rating_min,
  });

  const cached = await cacheGet<HotelSearchOutcome>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, 'Hotel search cache hit');
    return cached;
  }

  const params: Record<string, string | number | undefined> = {
    q: `hotels in ${input.city}`,
    check_in_date: input.check_in,
    check_out_date: input.check_out,
    adults: input.guests,
    currency: 'USD',
    hl: 'en',
  };

  let response: SerpApiHotelsResponse;
  try {
    response = (await serpApiGet(
      'google_hotels',
      params,
    )) as SerpApiHotelsResponse;
  } catch (err) {
    if (err instanceof SerpApiQuotaExceededError) {
      logger.warn(
        { city: input.city },
        'Hotel search unavailable: SerpApi monthly cap reached',
      );
      return {
        status: 'quota_exhausted',
        hotels: [],
        message:
          'Hotel search is temporarily unavailable: the monthly SerpApi quota for this demo has been reached. Try again next month or skip hotels for now.',
      };
    }
    // F-17: distinguish timeout from generic upstream errors so the
    // agent can narrate the appropriate state to the user.
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn(
      { err, city: input.city, errorMessage, isTimeout },
      'Hotel search failed; returning structured outcome',
    );
    return isTimeout
      ? {
          status: 'timeout',
          hotels: [],
          message:
            'Hotel search timed out before results arrived. The upstream API is slow right now; try again in a moment.',
        }
      : {
          status: 'error',
          hotels: [],
          message:
            'Hotel search hit an upstream error. The result is not "no hotels" -- the search itself failed. Suggest the user try again or proceed without hotels.',
        };
  }

  let results = (response.properties ?? []).map((h, i) =>
    normalizeHotel(h, i, input),
  );

  if (input.star_rating_min) {
    results = results.filter((r) => r.star_rating >= input.star_rating_min!);
  }

  if (input.max_price_per_night) {
    results = results.filter(
      (r) => r.price_per_night <= input.max_price_per_night!,
    );
  }

  // Track pre-price-filter count to distinguish "pricing data unavailable"
  // from "genuinely no results" when building the outcome message.
  const resultsBeforePriceFilter = results.length;

  // Remove hotels SerpApi returned without pricing -- they appear as $0 tiles
  // in the UI and create false "bookable" signals. Filter before sorting so
  // zero-priced hotels never reach the tile renderer.
  results = results.filter((r) => r.total_price > 0 || r.price_per_night > 0);

  results = results.sort((a, b) => a.total_price - b.total_price).slice(0, 5);

  let outcome: HotelSearchOutcome;
  if (results.length > 0) {
    outcome = { status: 'ok', hotels: results };
  } else if (resultsBeforePriceFilter > 0) {
    outcome = {
      status: 'no_results',
      hotels: [],
      message:
        'Hotel search returned results but pricing data was unavailable for all properties. This is a data gap, not "no hotels available." Suggest the user try different dates or proceed without hotels.',
    };
  } else {
    outcome = { status: 'no_results', hotels: [] };
  }

  await cacheSet(cacheKey, outcome, CACHE_TTL);
  logger.info(
    { count: results.length, city: input.city },
    'Hotel search complete',
  );

  return outcome;
}
