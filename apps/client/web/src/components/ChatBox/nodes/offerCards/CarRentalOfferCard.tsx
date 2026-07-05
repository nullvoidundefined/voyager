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
  selected,
  onClick,
}: OfferCardProps) {
  const detail = offer.detail ?? {};
  const rental: CarRental = {
    id: offer.id,
    provider: String(detail.provider ?? offer.subtitle ?? ''),
    car_name: String(detail.car_name ?? offer.title),
    car_type: String(detail.car_type ?? ''),
    price_per_day: Number(detail.price_per_day ?? 0),
    total_price: offer.price,
    currency: offer.currency,
    pickup_location: String(detail.pickup_location ?? ''),
    dropoff_location: String(detail.dropoff_location ?? ''),
    pickup_date: String(detail.pickup_date ?? ''),
    dropoff_date: String(detail.dropoff_date ?? ''),
    features: offer.badges ?? [],
    image_url: offer.image_url,
  };
  return (
    <CarRentalCard rental={rental} selected={selected} onClick={onClick} />
  );
}
