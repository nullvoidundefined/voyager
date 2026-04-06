import type { ChatNodeOfType } from '@voyager/shared-types';

import styles from './ToolProgressIndicator.module.scss';

interface ToolProgressIndicatorProps {
  node: ChatNodeOfType<'tool_progress'>;
}

const TOOL_LABELS: Record<string, string> = {
  search_flights: 'Searching flights',
  search_hotels: 'Searching hotels',
  search_car_rentals: 'Searching car rentals',
  search_experiences: 'Finding experiences',
  calculate_remaining_budget: 'Calculating budget',
  get_destination_info: 'Looking up destination',
  format_response: 'Assembling response',
};

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ');
}

export function ToolProgressIndicator({ node }: ToolProgressIndicatorProps) {
  const label = getToolLabel(node.tool_name);
  const isDone = node.status === 'done';

  return (
    <div
      className={`${styles.wrapper} ${isDone ? styles.done : styles.running}`}
      role='status'
      aria-label={isDone ? `${label} — complete` : `${label} — in progress`}
      aria-live='polite'
    >
      <span className={styles.statusIcon} aria-hidden='true'>
        {isDone ? '\u2713' : ''}
      </span>
      {!isDone && <span className={styles.spinner} aria-hidden='true' />}
      <span className={styles.label}>{label}</span>
      {isDone && <span className={styles.doneLabel}>Done</span>}
    </div>
  );
}
