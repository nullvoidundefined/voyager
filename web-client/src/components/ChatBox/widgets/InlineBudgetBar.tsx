import { formatCurrency } from '@/lib/format';

import styles from './InlineBudgetBar.module.scss';

interface InlineBudgetBarProps {
  allocated: number;
  total: number;
  currency: string;
}

export function InlineBudgetBar({
  allocated,
  total,
  currency,
}: InlineBudgetBarProps) {
  const pct = Math.min((allocated / total) * 100, 100);
  const overBudget = allocated > total;
  const remaining = total - allocated;

  return (
    <div className={styles.wrapper}>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${overBudget ? styles.over : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={styles.labels}>
        <span className={styles.allocated}>
          {formatCurrency(allocated, currency)} allocated
        </span>
        <span
          className={`${styles.remaining} ${overBudget ? styles.over : ''}`}
        >
          {formatCurrency(Math.abs(remaining), currency)}{' '}
          {overBudget ? 'over' : 'remaining'}
        </span>
      </div>
    </div>
  );
}
