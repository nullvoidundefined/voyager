/** Presents a destination Offer as a grazing card that commits into planning. */
import Image from 'next/image';

import type { Offer } from '@repo/types';

import { getDestinationImage } from '@/services/destinationImage';

import styles from './DestinationOfferCard.module.scss';

interface OfferCardProps {
  offer: Offer;
  onClick?: () => void;
  selected?: boolean;
}

export function DestinationOfferCard({
  offer,
  onClick,
  selected,
}: OfferCardProps) {
  const { url } = getDestinationImage(offer.title);
  return (
    <button
      type='button'
      className={selected ? styles.cardSelected : styles.card}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={styles.image}>
        {url ? <Image src={url} alt={offer.title} fill sizes='240px' /> : null}
      </span>
      <span className={styles.name}>{offer.title}</span>
      {offer.subtitle ? (
        <span className={styles.country}>{offer.subtitle}</span>
      ) : null}
      <span
        className={styles.budget}
      >{`from ~$${offer.price}/day (est.)`}</span>
      <span className={styles.badges}>
        {(offer.badges ?? []).map((badge) => (
          <span key={badge} className={styles.badge}>
            {badge}
          </span>
        ))}
      </span>
    </button>
  );
}
