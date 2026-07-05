/**
 * Maps a raw car-rental search item (SerpApi shape or persisted CarRental
 * tile) to the generic Offer. Features become badges; detail carries every
 * select_car_rental wire field for the client confirm payload.
 */
import type { Offer } from '@repo/types';

import { resolveOfferId } from 'app/segments/offerMappers/resolveOfferId.js';

interface CarRentalItem {
  id?: string;
  provider: string;
  provider_logo?: string;
  car_name: string;
  car_type?: string;
  price_per_day?: number;
  total_price: number;
  currency: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_date?: string;
  dropoff_date?: string;
  features?: string[];
  image_url?: string;
  booking_url?: string;
}

export function carRentalToOffer(item: unknown): Offer {
  const rental = item as CarRentalItem;
  const detail = buildCarRentalDetail(rental);

  return {
    id: resolveOfferId(rental.id),
    title: rental.car_name,
    subtitle: rental.provider,
    selection_label: `${rental.car_name} (${rental.provider})`,
    ...(rental.image_url ? { image_url: rental.image_url } : {}),
    price: rental.total_price,
    currency: rental.currency,
    price_unit: 'total',
    badges: rental.features ?? [],
    detail,
    ...(rental.booking_url ? { booking_url: rental.booking_url } : {}),
  };
}

/** Collects the select_car_rental wire fields, skipping absent optional values. */
function buildCarRentalDetail(
  rental: CarRentalItem,
): Record<string, string | number> {
  const detail: Record<string, string | number> = {
    provider: rental.provider,
    car_name: rental.car_name,
    total_price: rental.total_price,
  };
  if (rental.car_type) detail.car_type = rental.car_type;
  if (typeof rental.price_per_day === 'number') {
    detail.price_per_day = rental.price_per_day;
  }
  if (rental.pickup_location) detail.pickup_location = rental.pickup_location;
  if (rental.dropoff_location) {
    detail.dropoff_location = rental.dropoff_location;
  }
  if (rental.pickup_date) detail.pickup_date = rental.pickup_date;
  if (rental.dropoff_date) detail.dropoff_date = rental.dropoff_date;
  return detail;
}
