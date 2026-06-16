/**
 * Renders the ordered legs (origin-to-destination segments) of a travel itinerary so
 * users can see the route structure of a multi-stop trip at a glance.
 */
import styles from './LegList.module.scss';

export interface Leg {
  id: string;
  origin: string;
  destination: string;
  depart_date: string;
  leg_order: number;
}

interface LegListProps {
  legs: Leg[];
  onRemoveLeg: (legId: string) => void;
}

export function LegList({ legs, onRemoveLeg }: LegListProps) {
  if (legs.length === 0) {
    return <p className={styles.empty}>No legs added yet.</p>;
  }

  return (
    <ol className={styles.list}>
      {legs.map((leg) => (
        <li key={leg.id} className={styles.leg}>
          <span className={styles.route}>
            <span>{leg.origin}</span>
            <span className={styles.arrow}> to </span>
            <span>{leg.destination}</span>
          </span>
          <span className={styles.date}>{leg.depart_date}</span>
          <button
            type='button'
            className={styles.removeBtn}
            onClick={() => onRemoveLeg(leg.id)}
            aria-label={`Remove leg ${leg.origin} to ${leg.destination}`}
          >
            Remove
          </button>
        </li>
      ))}
    </ol>
  );
}
