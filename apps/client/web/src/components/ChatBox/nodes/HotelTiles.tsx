'use client';

/**
 * Renders a hotel_tiles chat node as a selectable group of HotelCards, letting
 * the user choose lodging inline so the conversation can record the selection
 * without a dedicated hotel-search page.
 */
import type { ChatNodeOfType } from '@repo/types';

import { HotelCard } from '../widgets/HotelCard';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup';
import styles from './TileLayout.module.scss';

interface HotelTilesProps {
  node: ChatNodeOfType<'hotel_tiles'>;
  onConfirm?: (label: string, data: Record<string, unknown>) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function HotelTiles({
  node,
  onConfirm,
  disabled,
  confirmedId,
}: HotelTilesProps) {
  const items = node.hotels.map((hotel) => ({
    id: hotel.id,
    label: `${hotel.name}, ${hotel.city}`,
    data: hotel as unknown as Record<string, unknown>,
    node: (selected: boolean, onClick: () => void) => (
      <HotelCard
        name={hotel.name}
        city={hotel.city}
        imageUrl={hotel.image_url ?? null}
        starRating={hotel.star_rating}
        pricePerNight={hotel.price_per_night}
        totalPrice={hotel.total_price}
        currency={hotel.currency}
        checkIn={hotel.check_in}
        checkOut={hotel.check_out}
        latitude={hotel.lat ?? null}
        longitude={hotel.lon ?? null}
        selected={selected}
        onClick={onClick}
      />
    ),
  }));

  if (!node.selectable) {
    return (
      <div className={styles.horizontalScroll}>
        {node.hotels.map((hotel) => (
          <HotelCard
            key={hotel.id}
            name={hotel.name}
            city={hotel.city}
            imageUrl={hotel.image_url ?? null}
            starRating={hotel.star_rating}
            pricePerNight={hotel.price_per_night}
            totalPrice={hotel.total_price}
            currency={hotel.currency}
            checkIn={hotel.check_in}
            checkOut={hotel.check_out}
            latitude={hotel.lat ?? null}
            longitude={hotel.lon ?? null}
          />
        ))}
      </div>
    );
  }

  return (
    <SelectableCardGroup
      items={items}
      onConfirm={onConfirm ?? (() => {})}
      disabled={disabled}
      confirmedId={confirmedId}
    />
  );
}
