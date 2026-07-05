/**
 * Generic card for offer kinds with no registered component. Guarantees an
 * unknown kind renders something selectable instead of crashing the chat
 * transcript (ChatBox invariant: registry misses degrade, never throw).
 */
import type { Offer } from '@repo/types';

import { formatCurrency } from '@/services/format';

interface OfferCardProps {
  offer: Offer;
  selected?: boolean;
  onClick?: () => void;
}

export function FallbackOfferCard({
  offer,
  selected = false,
  onClick,
}: OfferCardProps) {
  return (
    <button
      type='button'
      aria-pressed={selected}
      aria-label={`${offer.title}, ${formatCurrency(offer.price, offer.currency)}`}
      data-tile-card='offer'
      onClick={onClick}
    >
      <span>{offer.title}</span>
      {offer.subtitle && <span> {offer.subtitle}</span>}
      <span> {formatCurrency(offer.price, offer.currency)}</span>
    </button>
  );
}
