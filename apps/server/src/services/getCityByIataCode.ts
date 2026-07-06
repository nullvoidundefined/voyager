/**
 * Resolves an IATA airport code to its city record and display name using the
 * local CITY_DATABASE. Exists so map pins resolve airport codes against
 * authoritative data instead of free-text geocoding (the 2026-07-07
 * Iloilo-City incident: Mapbox matched "SFO airport" to a Philippine
 * neighborhood named "Airport").
 */
import { CITY_DATABASE } from 'app/data/cities.js';
import type { CityData } from 'app/data/cities.js';

interface CityByIataMatch {
  city: CityData;
  cityName: string;
}

export function getCityByIataCode(code: string): CityByIataMatch | null {
  const normalized = code.toUpperCase().trim();
  for (const [key, city] of Object.entries(CITY_DATABASE)) {
    const codes = [city.iata_code, ...(city.alternate_iata_codes ?? [])];
    if (codes.includes(normalized)) {
      return { city, cityName: toTitleCaseCityName(key) };
    }
  }
  return null;
}

function toTitleCaseCityName(key: string): string {
  return key
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
