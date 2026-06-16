/**
 * Row of one-tap quick-reply chips. Exists to let users answer the assistant
 * with a single click from a suggested set instead of typing, emitting the
 * chosen chip text back to the chat.
 */
import styles from './QuickReplyChips.module.scss';

interface QuickReplyChipsProps {
  chips: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function QuickReplyChips({
  chips,
  onSelect,
  disabled = false,
}: QuickReplyChipsProps) {
  return (
    <div className={styles.row} role='group' aria-label='Quick replies'>
      {chips.map((chip) => (
        <button
          key={chip}
          type='button'
          className={styles.chip}
          onClick={() => onSelect(chip)}
          disabled={disabled}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
