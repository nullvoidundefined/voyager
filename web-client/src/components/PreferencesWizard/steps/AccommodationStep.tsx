import { ACCOMMODATION_OPTIONS } from '@/lib/preferenceOptions';

import styles from '../PreferencesWizard.module.scss';

interface AccommodationStepProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function AccommodationStep({ value, onChange }: AccommodationStepProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>Where do you like to stay?</legend>
      <div className={styles.cardGrid}>
        {ACCOMMODATION_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`${styles.optionCard} ${value === opt.value ? styles.optionSelected : ''}`}
          >
            <input
              type='radio'
              name='accommodation'
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className={styles.srOnly}
            />
            <span className={styles.optionLabel}>{opt.label}</span>
            <span className={styles.optionDesc}>{opt.description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
