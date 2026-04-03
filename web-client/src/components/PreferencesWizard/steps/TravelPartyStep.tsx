import { TRAVEL_PARTY_OPTIONS } from '@/lib/preferenceOptions';

import styles from '../PreferencesWizard.module.scss';

interface TravelPartyStepProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function TravelPartyStep({ value, onChange }: TravelPartyStepProps) {
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
    </fieldset>
  );
}
