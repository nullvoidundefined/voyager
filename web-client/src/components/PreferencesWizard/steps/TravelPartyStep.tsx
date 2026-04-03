import { GENDER_OPTIONS, TRAVEL_PARTY_OPTIONS } from '@/lib/preferenceOptions';

import styles from '../PreferencesWizard.module.scss';

interface TravelPartyStepProps {
  value: string | null;
  onChange: (value: string | null) => void;
  lgbtqSafety?: boolean;
  onLgbtqSafetyChange?: (value: boolean) => void;
  gender?: string | null;
  onGenderChange?: (value: string | null) => void;
}

export function TravelPartyStep({
  value,
  onChange,
  lgbtqSafety,
  onLgbtqSafetyChange,
  gender,
  onGenderChange,
}: TravelPartyStepProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>Who do you usually travel with?</legend>
      <div className={styles.chipGroup}>
        {TRAVEL_PARTY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type='button'
            className={`${styles.chip} ${value === opt.value ? styles.chipSelected : ''}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {onLgbtqSafetyChange && onGenderChange && (
        <div className={styles.safetySection}>
          <p className={styles.safetyExplanation}>
            These optional questions help us surface relevant safety information
            for your destinations. Your answers are private and only used to
            personalize travel advisories.
          </p>

          <label className={styles.toggleLabel}>
            <input
              type='checkbox'
              checked={lgbtqSafety ?? false}
              onChange={(e) => onLgbtqSafetyChange(e.target.checked)}
              className={styles.toggleInput}
            />
            <span>Show LGBTQ+ travel safety information</span>
          </label>

          <div className={styles.genderField}>
            <label htmlFor='gender-select' className={styles.selectLabel}>
              How do you identify?{' '}
              <span className={styles.optional}>(optional)</span>
            </label>
            <select
              id='gender-select'
              value={gender ?? ''}
              onChange={(e) => onGenderChange(e.target.value || null)}
              className={styles.select}
            >
              <option value=''>Select...</option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </fieldset>
  );
}
