'use client';

/**
 * Inline structured-input form rendered inside the chat for collecting trip
 * details (destination, dates, budget, travelers). Exists so the assistant can
 * gather required fields as a typed form rather than free text, emitting both
 * machine-readable data and a human-readable display message on submit.
 */
import { type FormEvent, useEffect, useState } from 'react';

import styles from './TripDetailsForm.module.scss';

export interface TripField {
  type:
    | 'destination'
    | 'origin'
    | 'departure_date'
    | 'return_date'
    | 'budget'
    | 'travelers'
    | 'trip_type'
    | 'flexible_dates';
  label: string;
  required?: boolean;
}

interface TripDetailsFormProps {
  fields: TripField[];
  onSubmit: (
    structuredData: Record<string, string>,
    displayMessage: string,
  ) => void;
  onValuesChange?: (values: Record<string, string>) => void;
  disabled?: boolean;
  initialValues?: Record<string, string>;
  submitted?: boolean;
}

export function TripDetailsForm({
  fields,
  onSubmit,
  onValuesChange,
  disabled,
  initialValues,
  submitted,
}: TripDetailsFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    initialValues ?? {},
  );

  useEffect(() => {
    onValuesChange?.(values);
  }, [values, onValuesChange]);

  const isLocked = submitted || false;

  const set = (key: string, val: string) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const allFilled = fields.every(
    (f) =>
      f.type === 'trip_type' ||
      f.type === 'flexible_dates' ||
      f.required === false ||
      values[f.type]?.trim(),
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allFilled || isLocked) {
      return;
    }

    const parts: string[] = [];

    if (values.destination) {
      parts.push(`I want to go to ${values.destination}`);
    }
    if (values.origin) {
      parts.push(`I'm traveling from ${values.origin}`);
    }
    if (values.departure_date && values.return_date) {
      const fmt = (d: string) =>
        new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      parts.push(
        `from ${fmt(values.departure_date)} to ${fmt(values.return_date)}`,
      );
    } else if (values.departure_date) {
      const fmt = (d: string) =>
        new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      parts.push(`departing ${fmt(values.departure_date)}`);
    }
    if (values.budget) {
      parts.push(`with a $${values.budget} budget`);
    }
    if (values.travelers) {
      parts.push(
        values.travelers === '1'
          ? 'for 1 traveler'
          : `for ${values.travelers} travelers`,
      );
    }

    onSubmit(values, parts.join(', ') + '.');
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <form
      onSubmit={handleSubmit}
      className={`${styles.form} ${isLocked ? styles.locked : ''}`}
    >
      {fields.map((field) => (
        <div key={field.type} className={styles.field}>
          <label
            id={`${field.type}-label`}
            htmlFor={field.type}
            className={styles.label}
          >
            {field.label}
          </label>
          {field.type === 'destination' && (
            <input
              id='destination'
              type='text'
              className={styles.input}
              placeholder='e.g. Paris, Tokyo, Monterey'
              value={values.destination ?? ''}
              onChange={(e) => set('destination', e.target.value)}
              disabled={disabled || isLocked}
              readOnly={isLocked}
            />
          )}
          {field.type === 'origin' && (
            <input
              id='origin'
              type='text'
              className={styles.input}
              placeholder='e.g. New York, San Francisco'
              value={values.origin ?? ''}
              onChange={(e) => set('origin', e.target.value)}
              disabled={disabled || isLocked}
              readOnly={isLocked}
            />
          )}
          {field.type === 'departure_date' && (
            <input
              id='departure_date'
              type='date'
              className={styles.input}
              min={today}
              value={values.departure_date ?? ''}
              onChange={(e) => set('departure_date', e.target.value)}
              disabled={disabled || isLocked}
              readOnly={isLocked}
            />
          )}
          {field.type === 'trip_type' && (
            <div
              className={styles.tripTypeToggle}
              role='group'
              aria-labelledby='trip_type-label'
            >
              <button
                type='button'
                aria-pressed={
                  (values.trip_type ?? 'round_trip') === 'round_trip'
                }
                className={`${styles.tripTypeBtn} ${(values.trip_type ?? 'round_trip') === 'round_trip' ? styles.tripTypeBtnActive : ''}`}
                onClick={() => set('trip_type', 'round_trip')}
                disabled={disabled || isLocked}
              >
                Round Trip
              </button>
              <button
                type='button'
                aria-pressed={values.trip_type === 'one_way'}
                className={`${styles.tripTypeBtn} ${values.trip_type === 'one_way' ? styles.tripTypeBtnActive : ''}`}
                onClick={() => set('trip_type', 'one_way')}
                disabled={disabled || isLocked}
              >
                One Way
              </button>
            </div>
          )}
          {field.type === 'flexible_dates' && (
            <div
              className={styles.flexibleDatesToggle}
              role='group'
              aria-labelledby='flexible_dates-label'
            >
              <button
                type='button'
                aria-pressed={values.flexible_dates !== 'true'}
                className={`${styles.tripTypeBtn} ${values.flexible_dates !== 'true' ? styles.tripTypeBtnActive : ''}`}
                onClick={() => set('flexible_dates', 'false')}
                disabled={disabled || isLocked}
              >
                Fixed
              </button>
              <button
                type='button'
                aria-pressed={values.flexible_dates === 'true'}
                className={`${styles.tripTypeBtn} ${values.flexible_dates === 'true' ? styles.tripTypeBtnActive : ''}`}
                onClick={() => set('flexible_dates', 'true')}
                disabled={disabled || isLocked}
              >
                Flexible
              </button>
            </div>
          )}
          {field.type === 'return_date' && values.trip_type !== 'one_way' && (
            <input
              id='return_date'
              type='date'
              className={styles.input}
              min={values.departure_date || today}
              value={values.return_date ?? ''}
              onChange={(e) => set('return_date', e.target.value)}
              disabled={disabled || isLocked}
              readOnly={isLocked}
            />
          )}
          {field.type === 'budget' && (
            <>
              <div className={styles.budgetInput}>
                <span className={styles.prefix}>$</span>
                <input
                  id='budget'
                  type='number'
                  className={styles.input}
                  placeholder='3000'
                  min={100}
                  aria-describedby={
                    values.budget && Number(values.budget) < 100
                      ? 'budget-error'
                      : undefined
                  }
                  value={values.budget ?? ''}
                  onChange={(e) => set('budget', e.target.value)}
                  disabled={disabled || isLocked}
                  readOnly={isLocked}
                />
              </div>
              {values.budget && Number(values.budget) < 100 && (
                <p id='budget-error' className={styles.fieldError} role='alert'>
                  Budget must be at least $100.
                </p>
              )}
            </>
          )}
          {field.type === 'travelers' && (
            <input
              id='travelers'
              type='number'
              className={styles.input}
              placeholder='2'
              min={1}
              max={10}
              value={values.travelers ?? ''}
              onChange={(e) => set('travelers', e.target.value)}
              disabled={disabled || isLocked}
              readOnly={isLocked}
            />
          )}
        </div>
      ))}
      {!isLocked && (
        <button
          type='submit'
          className={styles.submit}
          disabled={disabled || !allFilled}
        >
          Start Planning
        </button>
      )}
    </form>
  );
}
