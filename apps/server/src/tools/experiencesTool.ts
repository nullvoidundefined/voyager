/**
 * Experiences search tool: queries the Google Places text-search API, maps
 * verbose place types to user-facing category buckets and price levels to
 * estimated costs, and caches results behind a circuit breaker to survive
 * upstream outages. Falls back to mock fixtures in eval/E2E mode.
 */
import { logger } from 'app/clients/logger.js';
import { env } from 'app/config/env.js';
import { CircuitBreaker } from 'app/resilience/CircuitBreaker.js';
import {
  cacheGet,
  cacheSet,
  normalizeCacheKey,
} from 'app/services/cache/cacheService.js';
import { generateMockExperiences } from 'app/tools/mock/experiencesMock.js';
import { isMockMode } from 'app/tools/mock/isMockMode.js';

const placesBreaker = new CircuitBreaker('GooglePlaces', {
  failureThreshold: 3,
  cooldownMs: 60_000,
  isRetryable: (err) => !err.message.includes('400'),
});

const CACHE_TTL = 3600;
// Bounds the outbound Places call so a hung socket cannot stall the synchronous
// agent loop; the breaker only trips on a thrown error, never on a stuck socket.
const PLACES_FETCH_TIMEOUT_MS = 15_000;
const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.photos,places.location';

export interface ExperienceSearchInput {
  location: string;
  categories: string[];
  max_price_per_person?: number;
  limit?: number;
}

export interface ExperienceResult {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  price_level: string | null;
  estimated_cost: number | null;
  category: string | null;
  photo_ref: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface GooglePlace {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  rating?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text: string };
  photos?: Array<{ name: string }>;
  location?: { latitude: number; longitude: number };
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 15,
  PRICE_LEVEL_MODERATE: 35,
  PRICE_LEVEL_EXPENSIVE: 75,
  PRICE_LEVEL_VERY_EXPENSIVE: 150,
};

// P3-08: map verbose Google Places primaryTypeDisplayName values to
// the user-friendly category buckets the UI groups experiences by.
// Unknown labels pass through unchanged so the experience tile still
// renders meaningful text instead of a missing field.
const CATEGORY_MAP: Record<string, string> = {
  tourist_attraction: 'sightseeing',
  point_of_interest: 'sightseeing',
  museum: 'cultural',
  art_gallery: 'cultural',
  church: 'cultural',
  hindu_temple: 'cultural',
  mosque: 'cultural',
  synagogue: 'cultural',
  restaurant: 'dining',
  cafe: 'dining',
  bar: 'nightlife',
  night_club: 'nightlife',
  park: 'outdoor',
  campground: 'outdoor',
  hiking_area: 'outdoor',
  amusement_park: 'entertainment',
  zoo: 'entertainment',
  aquarium: 'entertainment',
  shopping_mall: 'shopping',
  spa: 'wellness',
  gym: 'wellness',
  stadium: 'entertainment',
  movie_theater: 'entertainment',
};

function normalizeCategory(rawCategory: string | null): string | null {
  if (!rawCategory) return null;
  const lower = rawCategory.toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_MAP[lower] ?? rawCategory;
}

function normalizePlace(place: GooglePlace): ExperienceResult {
  return {
    place_id: place.id,
    name: place.displayName.text,
    address: place.formattedAddress,
    rating: place.rating ?? null,
    price_level: place.priceLevel ?? null,
    estimated_cost: place.priceLevel
      ? (PRICE_LEVEL_MAP[place.priceLevel] ?? null)
      : null,
    category: normalizeCategory(place.primaryTypeDisplayName?.text ?? null),
    photo_ref: place.photos?.[0]?.name ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
  };
}

export async function searchExperiences(
  input: ExperienceSearchInput,
): Promise<ExperienceResult[]> {
  // Mock mode for eval runs
  if (isMockMode()) {
    return generateMockExperiences(input);
  }

  const cacheKey = normalizeCacheKey('google_places', 'text-search', {
    location: input.location,
    categories: input.categories.join(','),
    limit: input.limit,
  });

  const cached = await cacheGet<ExperienceResult[]>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, 'Experience search cache hit');
    return cached;
  }

  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }

  const categoryText =
    input.categories.length > 0 ? input.categories.join(' ') + ' ' : '';
  const textQuery = `${categoryText}in ${input.location}`;

  const data = await placesBreaker.call(async () => {
    const response = await fetch(PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: input.limit || 5,
      }),
      signal: AbortSignal.timeout(PLACES_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Places API error: ${response.status} ${text}`);
    }

    return (await response.json()) as { places: GooglePlace[] };
  });
  const results = (data.places || []).map(normalizePlace);

  await cacheSet(cacheKey, results, CACHE_TTL);
  logger.info(
    { count: results.length, location: input.location },
    'Experience search complete',
  );

  return results;
}
