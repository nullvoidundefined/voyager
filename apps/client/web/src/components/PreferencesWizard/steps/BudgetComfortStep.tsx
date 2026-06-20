/**
 * Wizard step for the user's budget-comfort tier, rendering BUDGET_COMFORT_OPTIONS
 * as a single-select so the questionnaire records how much the user wants to
 * spend versus economize.
 */
import { BUDGET_COMFORT_OPTIONS } from '@/services/preferenceOptions';

import styles from '../PreferencesWizard.module.scss';

interface BudgetComfortStepProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function BudgetComfortStep({ value, onChange }: BudgetComfortStepProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>How do you think about budget?</legend>
      <div className={styles.cardColumn}>
        {BUDGET_COMFORT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`${styles.optionCard} ${value === opt.value ? styles.optionSelected : ''}`}
          >
            <input
              type='radio'
              name='budget_comfort'
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
