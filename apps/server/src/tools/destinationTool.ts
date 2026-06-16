/**
 * Destination-info tool: resolves a city name to its IATA codes, country,
 * timezone, currency, and best-time-to-visit via the local cities dataset. Gives
 * the agent canonical airport codes so downstream flight searches use real IATA
 * identifiers rather than free-text city names.
 */
import { lookupCity } from '../data/cities.js';

export interface DestinationInput {
  city_name: string;
}

export interface DestinationResult {
  city_name: string;
  iata_code: string | null;
  alternate_iata_codes: string[];
  country: string | null;
  timezone: string | null;
  currency: string | null;
  best_time_to_visit: string | null;
  error?: string;
}

export function getDestinationInfo(input: DestinationInput): DestinationResult {
  const normalized = input.city_name.trim().toLowerCase();
  const city = lookupCity(normalized);

  if (!city) {
    return {
      city_name: input.city_name.trim(),
      iata_code: null,
      alternate_iata_codes: [],
      country: null,
      timezone: null,
      currency: null,
      best_time_to_visit: null,
      error: `City "${input.city_name.trim()}" not found in database. Try a major city name or provide the IATA code directly.`,
    };
  }

  return {
    city_name: input.city_name.trim(),
    iata_code: city.iata_code || null,
    alternate_iata_codes: city.alternate_iata_codes ?? [],
    country: city.country_name || null,
    timezone: city.timezone || null,
    currency: city.currency || null,
    best_time_to_visit: city.best_time_to_visit ?? null,
  };
}
