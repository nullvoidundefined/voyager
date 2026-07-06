/**
 * Maps a raw flight search item (SerpApi shape or persisted Flight tile) to
 * the generic Offer. detail carries every select_flight wire field so the
 * client confirm payload stays sufficient for the repository insert.
 */
import type { Offer } from '@repo/types';

import { resolveOfferId } from 'app/segments/offerMappers/resolveOfferId.js';

interface FlightItem {
  id?: string;
  airline: string;
  airline_logo?: string | null;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time?: string;
  price: number;
  currency: string;
  cabin_class?: string;
  booking_url?: string;
}

export function flightToOffer(item: unknown): Offer {
  const flight = item as FlightItem;
  const detail: Record<string, string | number> = {
    airline: flight.airline,
    departure_time: flight.departure_time,
    destination: flight.destination,
    flight_number: flight.flight_number,
    origin: flight.origin,
  };
  if (flight.arrival_time) detail.arrival_time = flight.arrival_time;
  if (flight.cabin_class) detail.cabin_class = flight.cabin_class;

  return {
    id: resolveOfferId(flight.id),
    selection_label: `${flight.airline} ${flight.flight_number} - ${flight.origin} to ${flight.destination}`,
    subtitle: `${flight.origin} to ${flight.destination}`,
    title: `${flight.airline} ${flight.flight_number}`,
    ...(flight.airline_logo ? { image_url: flight.airline_logo } : {}),
    badges: flight.cabin_class ? [flight.cabin_class] : [],
    currency: flight.currency,
    detail,
    price: flight.price,
    price_unit: 'per_person',
    ...(flight.booking_url ? { booking_url: flight.booking_url } : {}),
  };
}
