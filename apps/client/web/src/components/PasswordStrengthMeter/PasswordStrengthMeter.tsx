/**
 * Visual gauge that classifies a password into strength tiers and gives users live
 * feedback during signup so they can choose a stronger credential.
 */
import styles from './PasswordStrengthMeter.module.scss';

type Strength = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

interface PasswordStrengthMeterProps {
  password: string;
}

// Score 0-4. Length is the dominant factor; character-class variety
// breaks ties. The meter is a UX nudge, not a security boundary; the
// actual enforcement is the 8-char minimum on the server.
export function scorePassword(password: string): Strength {
  if (!password) return 'empty';
  if (password.length < 8) return 'weak';

  let variety = 0;
  if (/[a-z]/.test(password)) variety += 1;
  if (/[A-Z]/.test(password)) variety += 1;
  if (/[0-9]/.test(password)) variety += 1;
  if (/[^A-Za-z0-9]/.test(password)) variety += 1;

  if (password.length >= 16 && variety >= 3) return 'strong';
  if (password.length >= 12 && variety >= 2) return 'good';
  return 'fair';
}

const LABELS: Record<Strength, string> = {
  empty: '',
  weak: 'Too short',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};

const ACTIVE_BARS: Record<Strength, number> = {
  empty: 0,
  weak: 1,
  fair: 2,
  good: 3,
  strong: 4,
};

export function PasswordStrengthMeter({
  password,
}: PasswordStrengthMeterProps) {
  const strength = scorePassword(password);
  const active = ACTIVE_BARS[strength];

  return (
    <div
      id='password-strength'
      className={styles.meter}
      aria-live='polite'
      aria-atomic='true'
    >
      <div className={styles.bars} aria-hidden='true'>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`${styles.bar} ${i < active ? styles[`bar-${strength}`] : ''}`}
          />
        ))}
      </div>
      <span className={`${styles.label} ${styles[`label-${strength}`]}`}>
        {strength === 'empty' ? '' : `Strength: ${LABELS[strength]}`}
      </span>
    </div>
  );
}
