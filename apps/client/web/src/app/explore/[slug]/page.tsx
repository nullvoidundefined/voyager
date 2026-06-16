/**
 * Destination detail page. Server-renders a single curated destination by slug
 * with metadata for SEO, returning notFound for unknown slugs so deep links and
 * crawlers get a proper 404.
 */
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DESTINATIONS, getDestinationBySlug } from '@/data/destinations';
import { getDestinationImage } from '@/lib/destinationImage/destinationImage';

import styles from './page.module.scss';

export function generateStaticParams() {
  return DESTINATIONS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dest = getDestinationBySlug(slug);
  if (!dest) return {};
  const description = dest.description.split('.')[0] + '.';
  return {
    title: `${dest.name} Travel Guide | Voyager`,
    description,
    openGraph: {
      title: `${dest.name} Travel Guide | Voyager`,
      description,
    },
  };
}

function formatPrice(level: 1 | 2 | 3 | 4): string {
  return '$'.repeat(level);
}

function formatCategoryLabel(value: string): string {
  return value
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dest = getDestinationBySlug(slug);
  if (!dest) notFound();

  const { url: heroUrl } = getDestinationImage(dest.name);

  const descriptionParagraphs = dest.description.split('\n\n');

  return (
    <div className={styles.page}>
      {/* 1. Hero */}
      <section className={styles.hero}>
        {heroUrl ? (
          <Image
            src={heroUrl}
            alt={`${dest.name}, ${dest.country}`}
            fill
            sizes='100vw'
            style={{ objectFit: 'cover' }}
            priority
          />
        ) : (
          <div className={styles.heroFallback} />
        )}
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{dest.name}</h1>
          <p className={styles.heroCountry}>{dest.country}</p>
        </div>
      </section>

      {/* 2. Quick Stats */}
      <section className={styles.statsBar} aria-label='Quick facts'>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Currency</span>
          <span className={styles.statValue}>{dest.currency}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Language</span>
          <span className={styles.statValue}>{dest.language}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Best Season</span>
          <span className={styles.statValue}>{dest.best_season}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Daily Budget</span>
          <span className={styles.statValue}>
            ${dest.estimated_daily_budget.budget} – $
            {dest.estimated_daily_budget.luxury}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Visa</span>
          <span className={styles.statValue}>{dest.visa_summary}</span>
        </div>
      </section>

      <div className={styles.content}>
        {/* 3. About */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About {dest.name}</h2>
          {descriptionParagraphs.map((para, i) => (
            <p key={i} className={styles.paragraph}>
              {para}
            </p>
          ))}
        </section>

        {/* 4. Top 10 Experiences */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Top 10 Experiences</h2>
          <div className={styles.experienceGrid}>
            {dest.top_experiences.map((exp) => (
              <article key={exp.name} className={styles.experienceCard}>
                <div className={styles.experienceHeader}>
                  <h3 className={styles.experienceName}>{exp.name}</h3>
                  <span className={styles.categoryBadge}>
                    {formatCategoryLabel(exp.category)}
                  </span>
                </div>
                <p className={styles.experienceDesc}>{exp.description}</p>
                <p className={styles.experienceCost}>
                  {exp.estimated_cost === 0
                    ? 'Free'
                    : `~$${exp.estimated_cost}`}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* 5. Dining Highlights */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Dining Highlights</h2>
          <div className={styles.diningList}>
            {dest.dining_highlights.map((item) => (
              <article key={item.name} className={styles.diningItem}>
                <div className={styles.diningHeader}>
                  <h3 className={styles.diningName}>{item.name}</h3>
                  <span className={styles.diningMeta}>
                    {item.cuisine} · {formatPrice(item.price_level)}
                  </span>
                </div>
                <p className={styles.diningDesc}>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 6. Neighborhoods */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Neighborhoods</h2>
          <div className={styles.neighborhoodList}>
            {dest.neighborhoods.map((n) => (
              <article key={n.name} className={styles.neighborhoodItem}>
                <h3 className={styles.neighborhoodName}>{n.name}</h3>
                <p className={styles.neighborhoodDesc}>{n.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 7. Weather */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Weather</h2>
          <table
            className={styles.weatherTable}
            aria-label='Monthly weather averages'
          >
            <thead>
              <tr className={styles.weatherRow}>
                <th scope='col' className={styles.weatherHeader}>
                  Month
                </th>
                {dest.weather.map((w) => (
                  <th
                    key={w.month}
                    scope='col'
                    className={styles.weatherHeader}
                  >
                    {w.month.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className={styles.weatherRow}>
                <th scope='row' className={styles.weatherLabel}>
                  High
                </th>
                {dest.weather.map((w) => (
                  <td key={w.month} className={styles.weatherHigh}>
                    {w.high_c}°
                  </td>
                ))}
              </tr>
              <tr className={styles.weatherRow}>
                <th scope='row' className={styles.weatherLabel}>
                  Low
                </th>
                {dest.weather.map((w) => (
                  <td key={w.month} className={styles.weatherLow}>
                    {w.low_c}°
                  </td>
                ))}
              </tr>
              <tr className={styles.weatherRow}>
                <th scope='row' className={styles.weatherLabel}>
                  Rain
                </th>
                {dest.weather.map((w) => (
                  <td key={w.month} className={styles.weatherRain}>
                    {w.rainfall_mm}mm
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>

        {/* 8. Travel Advisories */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Travel Advisories</h2>
          <div className={styles.advisory}>
            <h3 className={styles.advisoryLabel}>Visa Information</h3>
            <p>{dest.visa_summary}</p>
          </div>
        </section>

        {/* 9. CTA */}
        <section className={styles.ctaSection}>
          <h2 className={styles.ctaTitle}>Ready to go?</h2>
          <p className={styles.ctaSubtitle}>
            Let our AI travel agent plan the perfect trip to {dest.name}.
          </p>
          <Link
            href={`/trips/new?destination=${encodeURIComponent(dest.name)}`}
            className={styles.ctaButton}
          >
            Plan a trip to {dest.name}
          </Link>
        </section>
      </div>
    </div>
  );
}
