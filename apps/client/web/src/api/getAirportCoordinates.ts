/**
 * Fetch wrapper for GET /places/airport/:code, resolving an IATA airport code
 * to city coordinates from the backend's local database. Returns null for
 * unknown or invalid codes so callers can skip the pin instead of plotting a
 * wrong location.
 */
import { get } from '@/api/request';

interface AirportCoordinates {
  city: string;
  code: string;
  lat: number;
  lon: number;
}

export async function getAirportCoordinates(
  code: string,
): Promise<AirportCoordinates | null> {
  try {
    return await get<AirportCoordinates>(
      `/places/airport/${encodeURIComponent(code)}`,
    );
  } catch {
    return null;
  }
}
