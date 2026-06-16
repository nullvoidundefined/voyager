/**
 * Renders a list of external booking links (flights, hotels, activities) so users can
 * follow through to third-party providers from within an itinerary.
 */
import styles from './BookingLinks.module.scss';

export interface BookingLink {
  id: string;
  label: string;
  url: string;
  type: 'flight' | 'hotel' | 'car_rental' | 'experience';
}

const TYPE_LABEL: Record<BookingLink['type'], string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  car_rental: 'Car Rental',
  experience: 'Experience',
};

interface BookingLinksProps {
  links: BookingLink[];
}

export function BookingLinks({ links }: BookingLinksProps) {
  if (links.length === 0) {
    return <p className={styles.empty}>No bookings ready yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {links.map((link) => (
        <li key={link.id} className={styles.item}>
          <span className={styles.typeTag}>{TYPE_LABEL[link.type]}</span>
          <a
            href={link.url}
            target='_blank'
            rel='noopener noreferrer'
            className={styles.bookBtn}
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
