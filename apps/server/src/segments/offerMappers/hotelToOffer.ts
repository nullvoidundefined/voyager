/**
 * Maps a raw hotel search item (SerpApi shape or persisted Hotel tile) to the
 * generic Offer. detail carries every select_hotel wire field so the client
 * confirm payload stays sufficient for the repository insert.
 */
import type { Offer } from '@repo/types';

import { resolveOfferId } from 'app/segments/offerMappers/resolveOfferId.js';

interface HotelItem {
  id?: string;
  name: string;
  city?: string;
  image_url?: string;
  star_rating?: number;
  price_per_night?: number;
  total_price?: number;
  currency: string;
  check_in?: string;
  check_out?: string;
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
  booking_url?: string;
}

export function hotelToOffer(item: unknown): Offer {
  const hotel = item as HotelItem;
  const city = hotel.city ?? '';
  const totalPrice = hotel.total_price ?? 0;
  const lat = hotel.lat ?? hotel.latitude;
  const lon = hotel.lon ?? hotel.longitude;
  const detail = buildHotelDetail(hotel, city, totalPrice);

  return {
    id: resolveOfferId(hotel.id),
    title: hotel.name,
    ...(city ? { subtitle: city } : {}),
    selection_label: `${hotel.name}, ${city}`,
    ...(hotel.image_url ? { image_url: hotel.image_url } : {}),
    price: totalPrice,
    currency: hotel.currency,
    price_unit: 'total',
    badges:
      typeof hotel.star_rating === 'number'
        ? [`${hotel.star_rating}-star`]
        : [],
    detail,
    ...(hotel.booking_url ? { booking_url: hotel.booking_url } : {}),
    ...(typeof lat === 'number' ? { lat } : {}),
    ...(typeof lon === 'number' ? { lon } : {}),
  };
}

/** Collects the select_hotel wire fields, skipping absent optional values. */
function buildHotelDetail(
  hotel: HotelItem,
  city: string,
  totalPrice: number,
): Record<string, string | number> {
  const detail: Record<string, string | number> = {
    name: hotel.name,
    city,
    price_per_night: hotel.price_per_night ?? 0,
    total_price: totalPrice,
  };
  if (typeof hotel.star_rating === 'number') {
    detail.star_rating = hotel.star_rating;
  }
  if (hotel.check_in) detail.check_in = hotel.check_in;
  if (hotel.check_out) detail.check_out = hotel.check_out;
  return detail;
}
