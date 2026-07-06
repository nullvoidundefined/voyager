/** Adapts a generic car-rental Offer back to the CarRental object CarRentalCard renders. */
import type { CarRental, Offer } from '@repo/types';

import { CarRentalCard } from '../CarRentalCard';

interface OfferCardProps {
  offer: Offer;
  selected?: boolean;
  onClick?: () => void;
}

export function CarRentalOfferCard({
  offer,
  onClick,
  selected,
}: OfferCardProps) {
  const detail = offer.detail ?? {};
  const rental: CarRental = {
    car_name: String(detail.car_name ?? offer.title),
    car_type: String(detail.car_type ?? ''),
    currency: offer.currency,
    dropoff_date: String(detail.dropoff_date ?? ''),
    dropoff_location: String(detail.dropoff_location ?? ''),
    features: offer.badges ?? [],
    id: offer.id,
    image_url: offer.image_url,
    pickup_date: String(detail.pickup_date ?? ''),
    pickup_location: String(detail.pickup_location ?? ''),
    price_per_day: Number(detail.price_per_day ?? 0),
    provider: String(detail.provider ?? offer.subtitle ?? ''),
    total_price: offer.price,
  };
  return (
    <CarRentalCard rental={rental} selected={selected} onClick={onClick} />
  );
}
