/**
 * Compact budget meter showing allocated spend against a total, flagging an
 * over-budget state. Exists to give an at-a-glance cost signal inline within
 * chat cards without the full budget widget.
 */
import { formatCurrency } from '@/services/format';

import styles from './InlineBudgetBar.module.scss';

interface InlineBudgetBarProps {
  allocated: number | null | undefined;
  total: number | null | undefined;
  currency: string;
}

export function InlineBudgetBar({
  allocated,
  total,
  currency,
}: InlineBudgetBarProps) {
  const safeAllocated = allocated ?? 0;
  const safeTotal = total ?? 0;
  const pct =
    safeTotal > 0 ? Math.min((safeAllocated / safeTotal) * 100, 100) : 0;
  const overBudget = safeAllocated > safeTotal;
  const remaining = safeTotal - safeAllocated;

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
          {formatCurrency(safeAllocated, currency)} allocated
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
