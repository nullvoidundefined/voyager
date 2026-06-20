'use client';

/**
 * Renders a flight_tiles chat node as a selectable group of FlightCards, letting
 * the user pick a flight inline so the conversation can capture the selection
 * without routing to a separate booking screen.
 */
import type { ChatNodeOfType } from '@repo/types';

import { FlightCard } from '../widgets/FlightCard';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup';
import styles from './TileLayout.module.scss';

interface FlightTilesProps {
  node: ChatNodeOfType<'flight_tiles'>;
  onConfirm?: (label: string, data: Record<string, unknown>) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function FlightTiles({
  node,
  onConfirm,
  disabled,
  confirmedId,
}: FlightTilesProps) {
  const items = node.flights.map((flight) => ({
    id: flight.id,
    label: `${flight.airline} ${flight.flight_number} — ${flight.origin} to ${flight.destination}`,
    data: flight as unknown as Record<string, unknown>,
    node: (selected: boolean, onClick: () => void) => (
      <FlightCard
        airline={flight.airline}
        airlineLogo={flight.airline_logo ?? null}
        flightNumber={flight.flight_number}
        origin={flight.origin}
        destination={flight.destination}
        departureTime={flight.departure_time}
        price={flight.price}
        currency={flight.currency}
        selected={selected}
        onClick={onClick}
      />
    ),
  }));

  if (!node.selectable) {
    return (
      <div className={styles.verticalStack}>
        {node.flights.map((flight) => (
          <FlightCard
            key={flight.id}
            airline={flight.airline}
            airlineLogo={flight.airline_logo ?? null}
            flightNumber={flight.flight_number}
            origin={flight.origin}
            destination={flight.destination}
            departureTime={flight.departure_time}
            price={flight.price}
            currency={flight.currency}
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
