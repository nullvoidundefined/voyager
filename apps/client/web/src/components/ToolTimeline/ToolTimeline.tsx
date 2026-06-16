/**
 * Chronological view of the assistant's tool calls during a turn, exposing the
 * agentic steps so users can see what actions the AI took and in what order.
 */
import styles from './ToolTimeline.module.scss';

export interface ToolCall {
  id: string;
  toolName: string;
  status: 'running' | 'done' | 'error';
  durationMs: number;
}

interface ToolTimelineProps {
  toolCalls: ToolCall[];
}

const STATUS_CLASS: Record<ToolCall['status'], string> = {
  running: 'running',
  done: 'done',
  error: 'error',
};

export function ToolTimeline({ toolCalls }: ToolTimelineProps) {
  if (toolCalls.length === 0) {
    return <p className={styles.empty}>No tool calls yet.</p>;
  }

  return (
    <ol className={styles.timeline} aria-label='Agent tool call timeline'>
      {toolCalls.map((call) => (
        <li
          key={call.id}
          className={`${styles.step} ${styles[STATUS_CLASS[call.status]]}`}
        >
          <span className={styles.toolName}>{call.toolName}</span>
          {call.status === 'done' && call.durationMs > 0 && (
            <span className={styles.duration}>{call.durationMs}ms</span>
          )}
          {call.status === 'running' && (
            <span className={styles.spinner} aria-label='Running' />
          )}
        </li>
      ))}
    </ol>
  );
}
