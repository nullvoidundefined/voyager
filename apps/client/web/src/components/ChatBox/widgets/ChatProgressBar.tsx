/**
 * Progress bar for streaming chat work. Supports a determinate mode (done/total
 * with a latest-step label) and an indeterminate mode, so the UI can show real
 * tool progress when counts are known and an animated placeholder otherwise.
 */
import styles from './ChatProgressBar.module.scss';

type ChatProgressBarProps =
  | {
      mode: 'determinate';
      done: number;
      total: number;
      latestLabel: string;
    }
  | {
      mode: 'indeterminate';
      label: string;
    };

export function ChatProgressBar(props: ChatProgressBarProps) {
  if (props.mode === 'indeterminate') {
    return (
      <div className={styles.wrapper}>
        <div
          className={`${styles.track} ${styles.indeterminate}`}
          role='progressbar'
          aria-label={props.label}
        >
          <div className={styles.indeterminateFill} />
        </div>
        <div className={styles.label}>
          <span>{`${props.label}\u2026`}</span>
        </div>
      </div>
    );
  }

  const { done, total, latestLabel } = props;
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.min(100, Math.round((done / safeTotal) * 100));
  const isComplete = done >= total;
  const text = isComplete ? 'Done' : `${latestLabel}\u2026`;

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.track}
        role='progressbar'
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={text}
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.label}>
        <span>{text}</span>
      </div>
    </div>
  );
}
