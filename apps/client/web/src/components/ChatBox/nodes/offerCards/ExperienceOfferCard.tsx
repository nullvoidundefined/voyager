/** Adapts a generic experience Offer to the existing ExperienceCard presentational props. */
import type { Offer } from '@repo/types';

import { ExperienceCard } from '../../widgets/ExperienceCard';

interface OfferCardProps {
  offer: Offer;
  selected?: boolean;
  onClick?: () => void;
}

export function ExperienceOfferCard({
  offer,
  onClick,
  selected,
}: OfferCardProps) {
  const detail = offer.detail ?? {};
  return (
    <ExperienceCard
      name={String(detail.name ?? offer.title)}
      category={
        typeof detail.category === 'string'
          ? detail.category
          : (offer.subtitle ?? null)
      }
      photoRef={typeof detail.photo_ref === 'string' ? detail.photo_ref : null}
      rating={typeof detail.rating === 'number' ? detail.rating : null}
      estimatedCost={offer.price}
      latitude={offer.lat ?? null}
      longitude={offer.lon ?? null}
      selected={selected}
      onClick={onClick}
    />
  );
}
