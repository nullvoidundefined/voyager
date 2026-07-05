/** Adapts a generic flight Offer to the existing FlightCard presentational props. */
import type { Offer } from '@repo/types';

import { FlightCard } from '../../widgets/FlightCard';

interface OfferCardProps {
  offer: Offer;
  selected?: boolean;
  onClick?: () => void;
}

export function FlightOfferCard({ offer, selected, onClick }: OfferCardProps) {
  const detail = offer.detail ?? {};
  return (
    <FlightCard
      airline={String(detail.airline ?? offer.title)}
      airlineLogo={offer.image_url ?? null}
      flightNumber={String(detail.flight_number ?? '')}
      origin={String(detail.origin ?? '')}
      destination={String(detail.destination ?? '')}
      departureTime={String(detail.departure_time ?? '')}
      price={offer.price}
      currency={offer.currency}
      selected={selected}
      onClick={onClick}
    />
  );
}
