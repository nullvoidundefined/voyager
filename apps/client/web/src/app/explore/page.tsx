'use client';

/**
 * Explore index page. Lets visitors browse and filter the curated destination
 * catalog, the public discovery surface that seeds trip ideas before sign-in.
 */
import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import {
  CATEGORY_FILTERS,
  DESTINATIONS,
  type Destination,
} from '@/data/destinations';
import { HERO_IMAGES, getDestinationImage } from '@/services/destinationImage';

import styles from './page.module.scss';

function formatCategory(value: string): string {
  const found = CATEGORY_FILTERS.find((f) => f.value === value);
  if (found && found.value !== 'all') return found.label;
  // Fallback for any value not in the filter list
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered: Destination[] = DESTINATIONS.filter((d) => {
    const matchesCategory =
      activeCategory === 'all' || d.categories.includes(activeCategory);
    const matchesSearch =
      !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className={styles.page}>
      {/* — Hero — */}
      <section className={styles.hero} aria-label='Explore destinations hero'>
        <Image
          src={HERO_IMAGES[0].url}
          alt={`${HERO_IMAGES[0].city} destination`}
          fill
          className={styles.heroImage}
          priority
          sizes='100vw'
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            <em>Discover your next adventure</em>
          </h1>
          <p className={styles.heroSubtitle}>
            Explore handpicked destinations with local tips, dining
            recommendations, and insider knowledge.
          </p>
        </div>
      </section>

      {/* — Filters — */}
      <section
        className={styles.filtersSection}
        aria-label='Filter destinations by category'
      >
        <input
          type='text'
          className={styles.searchInput}
          placeholder='Search destinations...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label='Search destinations'
        />
        <div className={styles.filters}>
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={`${styles.filterPill} ${activeCategory === filter.value ? styles.filterPillActive : ''}`}
              onClick={() => setActiveCategory(filter.value)}
              aria-pressed={activeCategory === filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {/* — Grid — */}
      <section className={styles.gridSection} aria-label='Destination cards'>
        <p className={styles.resultCount}>
          {filtered.length}{' '}
          {filtered.length === 1 ? 'destination' : 'destinations'}
        </p>
        <div className={styles.grid}>
          {filtered.map((dest) => {
            const { url: imageUrl } = getDestinationImage(dest.name);
            return (
              <Link
                key={dest.slug}
                href={`/explore/${dest.slug}`}
                className={styles.card}
                aria-label={`${dest.name}, ${dest.country}`}
                data-destination-card={dest.slug}
              >
                <div className={styles.cardImage}>
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={dest.name}
                      fill
                      sizes='(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw'
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className={styles.cardImageFallback}
                      aria-hidden='true'
                    >
                      {dest.name}
                    </div>
                  )}
                </div>
                <div className={styles.cardContent}>
                  <h3 className={styles.cardCity}>{dest.name}</h3>
                  <p className={styles.country}>{dest.country}</p>
                  <div className={styles.cardMeta}>
                    <span
                      className={styles.price}
                      aria-label={`Price level: ${'$'.repeat(dest.price_level)}`}
                    >
                      {'$'.repeat(dest.price_level)}
                    </span>
                    <span className={styles.season}>
                      Best: {dest.best_season}
                    </span>
                  </div>
                  <div className={styles.tags} aria-label='Categories'>
                    {dest.categories.slice(0, 2).map((cat) => (
                      <span key={cat} className={styles.tag}>
                        {formatCategory(cat)}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
