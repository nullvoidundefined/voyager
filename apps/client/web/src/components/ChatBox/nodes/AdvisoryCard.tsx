/**
 * Renders an advisory chat node as a severity-tagged card (info, warning, etc.),
 * surfacing travel cautions inline in the assistant conversation so users see
 * safety and logistics notices without leaving the chat flow.
 */
import type { ChatNodeOfType } from '@repo/types';

import styles from './AdvisoryCard.module.scss';

interface AdvisoryCardProps {
  node: ChatNodeOfType<'advisory'>;
}

const SEVERITY_ICONS: Record<string, string> = {
  info: '\u2139\ufe0f',
  warning: '\u26a0\ufe0f',
  critical: '\ud83d\udea8',
};

const SEVERITY_LABELS: Record<string, string> = {
  info: 'Advisory',
  warning: 'Warning',
  critical: 'Critical Alert',
};

export function AdvisoryCard({ node }: AdvisoryCardProps) {
  const icon = SEVERITY_ICONS[node.severity] ?? SEVERITY_ICONS.info;
  const label = SEVERITY_LABELS[node.severity] ?? 'Advisory';

  return (
    <div
      className={`${styles.card} ${styles[node.severity]}`}
      role='alert'
      aria-label={`${label}: ${node.title}`}
    >
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden='true'>
          {icon}
        </span>
        <div className={styles.titleGroup}>
          <span className={styles.severityLabel}>{label}</span>
          <span className={styles.title}>{node.title}</span>
        </div>
      </div>
      <p className={styles.body}>{node.body}</p>
    </div>
  );
}
