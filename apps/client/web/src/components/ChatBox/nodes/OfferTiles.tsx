'use client';

/**
 * Generic container for offer_tiles nodes: renders any OfferKind through the
 * offer card registry inside the shared select-then-confirm group. Replaces
 * FlightTiles/HotelTiles/CarRentalTiles/ExperienceTiles.
 */
import type { ChatNodeOfType, Offer } from '@repo/types';

import { SelectableCardGroup } from '../widgets/SelectableCardGroup';
import styles from './TileLayout.module.scss';
import { resolveOfferCard } from './offerCardRegistry';

interface OfferTilesProps {
  node: ChatNodeOfType<'offer_tiles'>;
  onConfirm?: (label: string, data: Record<string, unknown>) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function OfferTiles({
  confirmedId,
  disabled,
  node,
  onConfirm,
}: OfferTilesProps) {
  const entry = resolveOfferCard(node.offer_kind);
  const OfferCard = entry.Card;

  if (!node.selectable) {
    return (
      <div
        className={
          entry.stackVertically ? styles.verticalStack : styles.horizontalScroll
        }
      >
        {node.offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    );
  }

  const items = node.offers.map((offer) => ({
    data: buildConfirmData(offer),
    id: offer.id,
    label: offer.selection_label ?? offer.title,
    node: (selected: boolean, onClick: () => void) => (
      <OfferCard offer={offer} selected={selected} onClick={onClick} />
    ),
  }));

  return (
    <SelectableCardGroup
      items={items}
      onConfirm={onConfirm ?? (() => {})}
      disabled={disabled}
      confirmedId={confirmedId}
    />
  );
}

/** Confirm payload: every select-tool wire field plus display price/currency. */
function buildConfirmData(offer: Offer): Record<string, unknown> {
  return {
    ...(offer.detail ?? {}),
    currency: offer.currency,
    price: offer.price,
    ...(offer.booking_url ? { booking_url: offer.booking_url } : {}),
  };
}
