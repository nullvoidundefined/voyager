import { TRAVEL_PACE_OPTIONS } from '@/lib/preferenceOptions';

import styles from '../PreferencesWizard.module.scss';

interface TravelPaceStepProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function TravelPaceStep({ value, onChange }: TravelPaceStepProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>What pace do you prefer?</legend>
      <div className={styles.cardRow}>
        {TRAVEL_PACE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`${styles.optionCard} ${value === opt.value ? styles.optionSelected : ''}`}
          >
            <input
              type='radio'
              name='travel_pace'
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
