import { ACTIVITY_OPTIONS } from '@/lib/preferenceOptions';

import styles from '../PreferencesWizard.module.scss';

interface ActivitiesStepProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function ActivitiesStep({ value, onChange }: ActivitiesStepProps) {
  function toggle(opt: string) {
    const next = value.includes(opt)
      ? value.filter((v) => v !== opt)
      : [...value, opt];
    onChange(next);
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend>What do you enjoy? (select all that apply)</legend>
      <div className={styles.activityGrid}>
        {ACTIVITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type='button'
            className={`${styles.chip} ${value.includes(opt.value) ? styles.chipSelected : ''}`}
            onClick={() => toggle(opt.value)}
            aria-pressed={value.includes(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
