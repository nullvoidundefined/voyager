'use client';

/**
 * Generic single-select group wrapper for option cards (flights, hotels, car
 * rentals, experiences). Exists to centralize the select-then-confirm
 * interaction and confirmed-state handling, rendering each item via a
 * caller-supplied node so card visuals stay decoupled from selection logic.
 */
import { Fragment, type ReactNode, useState } from 'react';

import styles from './SelectableCardGroup.module.scss';

interface SelectableCardGroupProps {
  items: Array<{
    id: string;
    label: string;
    data?: Record<string, unknown>;
    node: (selected: boolean, onClick: () => void) => ReactNode;
  }>;
  onConfirm: (
    selectedLabel: string,
    selectedData: Record<string, unknown>,
  ) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function SelectableCardGroup({
  items,
  onConfirm,
  disabled = false,
  confirmedId,
}: SelectableCardGroupProps) {
  const isConfirmed = confirmedId != null;
  const confirmedLabel = isConfirmed
    ? items.find((i) => i.id === confirmedId)?.label
    : null;
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleClick = (id: string) => {
    if (isConfirmed || disabled) return;
    setPendingId(id);
  };

  const handleConfirm = () => {
    if (isConfirmed || disabled || !pendingId) return;
    const item = items.find((i) => i.id === pendingId);
    if (item) {
      onConfirm(item.label, item.data ?? {});
    }
  };

  return (
    <div className={styles.group}>
      <div className={styles.scrollContainer}>
        {items.map((item) => {
          const selected = isConfirmed
            ? item.id === confirmedId
            : item.id === pendingId;
          return (
            <Fragment key={item.id}>
              {item.node(selected, () => handleClick(item.id))}
            </Fragment>
          );
        })}
      </div>

      {isConfirmed && confirmedLabel && (
        <span className={styles.confirmed}>&#10003; {confirmedLabel}</span>
      )}

      {!isConfirmed && pendingId && !disabled && (
        <button
          type='button'
          className={styles.confirmButton}
          onClick={handleConfirm}
        >
          Confirm Selection
        </button>
      )}
    </div>
  );
}
