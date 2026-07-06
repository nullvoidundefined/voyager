/**
 * Builds the TripMap pins for a trip: hotels and experiences via Mapbox
 * geocoding, airports via the backend's local IATA database. Airport codes are
 * never free-text geocoded (the 2026-07-07 Iloilo-City incident: Mapbox
 * matched "SFO airport" to a Philippine neighborhood named "Airport").
 * Pin order sets the map center: hotels, then experiences, then each flight's
 * destination airport before its origin.
 */
import { getAirportCoordinates } from '@/api/getAirportCoordinates';
import type { MapPin } from '@/components/TripMap/TripMap';

interface TripMapSource {
  destination: string;
  flights: { id: string; origin: string | null; destination: string | null }[];
  hotels: { id: string; name: string | null; city: string | null }[];
  experiences: { id: string; name: string | null }[];
}

export async function buildTripMapPins(
  trip: TripMapSource,
  token: string,
): Promise<MapPin[]> {
  const tasks: Promise<MapPin | null>[] = [];

  for (const hotel of trip.hotels) {
    tasks.push(buildHotelPin(hotel, token));
  }

  for (const experience of trip.experiences) {
    tasks.push(buildExperiencePin(experience, trip.destination, token));
  }

  const seenAirports = new Set<string>();
  for (const flight of trip.flights) {
    // Destination before origin so an airports-only pin list centers the
    // map on the trip destination, not where the user flew from.
    for (const code of [flight.destination, flight.origin]) {
      if (!code || seenAirports.has(code)) continue;
      seenAirports.add(code);
      tasks.push(buildAirportPin(code));
    }
  }

  const results = await Promise.all(tasks);
  return results.filter((pin): pin is MapPin => pin !== null);
}

async function buildHotelPin(
  hotel: TripMapSource['hotels'][number],
  token: string,
): Promise<MapPin | null> {
  const query = [hotel.name, hotel.city].filter(Boolean).join(', ');
  if (!query) return null;
  const coords = await geocodePlace(query, token);
  if (!coords) return null;
  return {
    id: hotel.id,
    label: hotel.name ?? 'Hotel',
    lat: coords[1],
    lng: coords[0],
    type: 'hotel',
  };
}

async function buildExperiencePin(
  experience: TripMapSource['experiences'][number],
  destination: string,
  token: string,
): Promise<MapPin | null> {
  if (!experience.name) return null;
  const coords = await geocodePlace(
    `${experience.name}, ${destination}`,
    token,
  );
  if (!coords) return null;
  return {
    id: experience.id,
    label: experience.name,
    lat: coords[1],
    lng: coords[0],
    type: 'experience',
  };
}

async function buildAirportPin(code: string): Promise<MapPin | null> {
  const airport = await getAirportCoordinates(code);
  if (!airport) return null;
  return {
    id: `airport-${code}`,
    label: `${code} Airport`,
    lat: airport.lat,
    lng: airport.lon,
    type: 'leg',
  };
}

async function geocodePlace(
  query: string,
  token: string,
): Promise<[number, number] | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features: { center: [number, number] }[];
  };
  return data.features[0]?.center ?? null;
}
