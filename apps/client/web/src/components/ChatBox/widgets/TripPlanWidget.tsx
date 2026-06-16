'use client';

/**
 * Editable summary card for a proposed trip plan. Exists to let travelers review
 * and tweak a draft plan before confirming, cloning the card locally so edits
 * stay uncommitted until confirm emits the final card plus a summary message.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { TripPlanCard } from '@voyager/shared-types';

import styles from './TripPlanWidget.module.scss';

interface TripPlanWidgetProps {
  planCard: TripPlanCard;
  onConfirm: (confirmedCard: TripPlanCard, summaryMessage: string) => void;
  disabled?: boolean;
  confirmed?: boolean;
}

function deepCloneCard(card: TripPlanCard): TripPlanCard {
  return JSON.parse(JSON.stringify(card)) as TripPlanCard;
}

function buildSummaryMessage(card: TripPlanCard): string {
  const parts: string[] = [];

  for (const cat of card.categories) {
    if (!cat.enabled || cat.not_applicable) continue;

    let label = cat.label.toLowerCase();

    if (cat.id === 'flights') {
      const radioOpt = cat.sub_options?.find(
        (o) => o.type === 'radio' && o.id === 'trip_type',
      );
      if (radioOpt?.type === 'radio') {
        const chosen = radioOpt.options.find((o) => o.id === radioOpt.value);
        if (chosen) label += ` (${chosen.label.toLowerCase()})`;
      }
    }

    if (cat.id === 'experiences') {
      const multiOpt = cat.sub_options?.find(
        (o) => o.type === 'multi' && o.id === 'interests',
      );
      if (multiOpt?.type === 'multi' && multiOpt.values.length > 0) {
        label += ` (${multiOpt.values.join(', ')})`;
      }
    }

    parts.push(label);
  }

  if (parts.length === 0) return "Let's start planning my trip.";
  if (parts.length === 1) return `I'd like to plan: ${parts[0]}.`;
  const last = parts.pop()!;
  return `I'd like to plan: ${parts.join(', ')} and ${last}.`;
}

export function TripPlanWidget({
  planCard,
  onConfirm,
  disabled = false,
  confirmed = false,
}: TripPlanWidgetProps) {
  const [localCard, setLocalCard] = useState<TripPlanCard>(() =>
    deepCloneCard(planCard),
  );
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isAutoEnabled, setIsAutoEnabled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (confirmed || disabled) return;
    timerRef.current = setTimeout(() => setIsAutoEnabled(true), 1500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [confirmed, disabled]);

  const markInteracted = useCallback(() => {
    setHasInteracted(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const canConfirm =
    !disabled && !confirmed && (hasInteracted || isAutoEnabled);

  const toggleCategory = useCallback(
    (id: string) => {
      markInteracted();
      setLocalCard((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === id && !cat.not_applicable
            ? { ...cat, enabled: !cat.enabled }
            : cat,
        ),
      }));
    },
    [markInteracted],
  );

  const setRadioValue = useCallback(
    (catId: string, optId: string, value: string) => {
      markInteracted();
      setLocalCard((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === catId
            ? {
                ...cat,
                sub_options: cat.sub_options?.map((opt) =>
                  opt.id === optId && opt.type === 'radio'
                    ? { ...opt, value }
                    : opt,
                ),
              }
            : cat,
        ),
      }));
    },
    [markInteracted],
  );

  const toggleMultiValue = useCallback(
    (catId: string, optId: string, value: string) => {
      markInteracted();
      setLocalCard((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === catId
            ? {
                ...cat,
                sub_options: cat.sub_options?.map((opt) =>
                  opt.id === optId && opt.type === 'multi'
                    ? {
                        ...opt,
                        values: opt.values.includes(value)
                          ? opt.values.filter((v) => v !== value)
                          : [...opt.values, value],
                      }
                    : opt,
                ),
              }
            : cat,
        ),
      }));
    },
    [markInteracted],
  );

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm(localCard, buildSummaryMessage(localCard));
  }, [canConfirm, localCard, onConfirm]);

  if (confirmed || disabled) {
    const enabledCategories = localCard.categories.filter(
      (c) => c.enabled && !c.not_applicable,
    );
    return (
      <div className={styles.wrapper} data-confirmed='true'>
        <p className={styles.confirmedLabel}>Plan confirmed</p>
        <ul className={styles.summary}>
          {enabledCategories.map((cat) => (
            <li key={cat.id} className={styles.summaryItem}>
              {cat.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.intro}>
        Here&#39;s the plan. Toggle anything off if you don&#39;t need it.
      </p>
      <ul className={styles.categoryList}>
        {localCard.categories.map((cat) => (
          <li key={cat.id} className={styles.categoryRow}>
            <label
              className={`${styles.categoryLabel} ${cat.not_applicable ? styles.notApplicable : ''}`}
            >
              <input
                type='checkbox'
                className={styles.toggle}
                checked={cat.enabled && !cat.not_applicable}
                disabled={cat.not_applicable}
                aria-disabled={cat.not_applicable}
                onChange={() => toggleCategory(cat.id)}
                aria-label={cat.label}
              />
              <span className={styles.categoryName}>{cat.label}</span>
              {cat.not_applicable && cat.not_applicable_reason && (
                <span className={styles.naReason}>
                  {cat.not_applicable_reason}
                </span>
              )}
            </label>

            {cat.enabled && !cat.not_applicable && cat.sub_options && (
              <div className={styles.subOptions}>
                {cat.sub_options.map((opt) => {
                  if (opt.type === 'radio') {
                    return (
                      <fieldset key={opt.id} className={styles.fieldset}>
                        <legend className={styles.legend}>{opt.label}</legend>
                        <div className={styles.radioGroup}>
                          {opt.options.map((o) => (
                            <label key={o.id} className={styles.radioLabel}>
                              <input
                                type='radio'
                                name={`${cat.id}-${opt.id}`}
                                value={o.id}
                                checked={opt.value === o.id}
                                onChange={() =>
                                  setRadioValue(cat.id, opt.id, o.id)
                                }
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  }
                  if (opt.type === 'multi') {
                    return (
                      <fieldset key={opt.id} className={styles.fieldset}>
                        <legend className={styles.legend}>{opt.label}</legend>
                        <div className={styles.checkGroup}>
                          {opt.options.map((o) => (
                            <label key={o.id} className={styles.checkLabel}>
                              <input
                                type='checkbox'
                                value={o.id}
                                checked={opt.values.includes(o.id)}
                                onChange={() =>
                                  toggleMultiValue(cat.id, opt.id, o.id)
                                }
                                aria-label={o.label}
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        type='button'
        className={styles.confirmButton}
        onClick={handleConfirm}
        disabled={!canConfirm}
        aria-disabled={!canConfirm}
      >
        Start planning
      </button>
    </div>
  );
}
