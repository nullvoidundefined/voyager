/**
 * Displays cumulative token usage and USD cost for a session, giving users visibility
 * into the running expense of AI generation.
 */
import styles from './CostCounter.module.scss';

interface CostCounterProps {
  totalTokens: number;
  totalCostUsd: string;
}

function formatCost(raw: string): string {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n === 0) return '0.00';
  if (n < 0.01) return n.toFixed(4);
  return n.toFixed(2);
}

export function CostCounter({ totalTokens, totalCostUsd }: CostCounterProps) {
  return (
    <div className={styles.counter} aria-label='AI cost for this trip'>
      <span className={styles.stat}>{totalTokens.toLocaleString()} tokens</span>
      <span className={styles.separator} aria-hidden='true'>
        |
      </span>
      <span className={styles.stat}>${formatCost(totalCostUsd)}</span>
    </div>
  );
}
