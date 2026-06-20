'use client';

/**
 * Renders a car_rental_tiles chat node as a selectable group of CarRentalCards,
 * letting the user pick a rental directly in the conversation and feed that
 * choice back into the trip without a separate page.
 */
import type { ChatNodeOfType } from '@repo/types';

import { SelectableCardGroup } from '../widgets/SelectableCardGroup';
import { CarRentalCard } from './CarRentalCard';
import styles from './TileLayout.module.scss';

interface CarRentalTilesProps {
  node: ChatNodeOfType<'car_rental_tiles'>;
  onConfirm?: (label: string, data: Record<string, unknown>) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function CarRentalTiles({
  node,
  onConfirm,
  disabled,
  confirmedId,
}: CarRentalTilesProps) {
  const items = node.rentals.map((rental) => ({
    id: rental.id,
    label: `${rental.car_name} (${rental.provider})`,
    data: rental as unknown as Record<string, unknown>,
    node: (selected: boolean, onClick: () => void) => (
      <CarRentalCard rental={rental} selected={selected} onClick={onClick} />
    ),
  }));

  if (!node.selectable) {
    return (
      <div className={styles.horizontalScroll}>
        {node.rentals.map((rental) => (
          <CarRentalCard key={rental.id} rental={rental} />
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
