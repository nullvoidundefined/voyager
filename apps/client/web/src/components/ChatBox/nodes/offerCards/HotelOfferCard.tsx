/** Adapts a generic hotel Offer to the existing HotelCard presentational props. */
import type { Offer } from '@repo/types';

import { HotelCard } from '../../widgets/HotelCard';

interface OfferCardProps {
  offer: Offer;
  selected?: boolean;
  onClick?: () => void;
}

export function HotelOfferCard({ offer, selected, onClick }: OfferCardProps) {
  const detail = offer.detail ?? {};
  return (
    <HotelCard
      name={String(detail.name ?? offer.title)}
      city={String(detail.city ?? offer.subtitle ?? '')}
      imageUrl={offer.image_url ?? null}
      starRating={
        typeof detail.star_rating === 'number' ? detail.star_rating : null
      }
      pricePerNight={Number(detail.price_per_night ?? 0)}
      totalPrice={offer.price}
      currency={offer.currency}
      checkIn={String(detail.check_in ?? '')}
      checkOut={String(detail.check_out ?? '')}
      latitude={offer.lat ?? null}
      longitude={offer.lon ?? null}
      selected={selected}
      onClick={onClick}
    />
  );
}
