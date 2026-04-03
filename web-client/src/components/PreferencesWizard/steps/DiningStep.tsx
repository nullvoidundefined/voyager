import { DIETARY_OPTIONS, DINING_STYLE_OPTIONS } from '@/lib/preferenceOptions';

import styles from '../PreferencesWizard.module.scss';

interface DiningStepProps {
  value: { dietary: string[]; dining_style: string | null };
  onChange: (value: { dietary: string[]; dining_style: string | null }) => void;
}

export function DiningStep({ value, onChange }: DiningStepProps) {
  function toggleDietary(opt: string) {
    const current = value.dietary;
    if (opt === 'none') {
      const next = current.includes('none') ? [] : ['none'];
      onChange({ ...value, dietary: next });
      return;
    }
    const without = current.filter((d) => d !== 'none');
    const next = without.includes(opt)
      ? without.filter((d) => d !== opt)
      : [...without, opt];
    onChange({ ...value, dietary: next });
  }

  return (
    <div className={styles.stepSections}>
      <fieldset className={styles.fieldset}>
        <legend>Dietary restrictions</legend>
        <div className={styles.chipGroup}>
          {DIETARY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type='button'
              className={`${styles.chip} ${value.dietary.includes(opt.value) ? styles.chipSelected : ''}`}
              onClick={() => toggleDietary(opt.value)}
              aria-pressed={value.dietary.includes(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Dining style</legend>
        <div className={styles.cardGrid}>
          {DINING_STYLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`${styles.optionCard} ${value.dining_style === opt.value ? styles.optionSelected : ''}`}
            >
              <input
                type='radio'
                name='dining_style'
                value={opt.value}
                checked={value.dining_style === opt.value}
                onChange={() => onChange({ ...value, dining_style: opt.value })}
                className={styles.srOnly}
              />
              <span className={styles.optionLabel}>{opt.label}</span>
              <span className={styles.optionDesc}>{opt.description}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
