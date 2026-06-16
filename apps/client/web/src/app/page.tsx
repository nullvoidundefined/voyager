'use client';

/**
 * Landing page. Presents the marketing hero and scripted demo chat, and redirects
 * already-authenticated visitors into the app so the public home is shown only to
 * logged-out users.
 */
import { useEffect } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DemoBanner } from '@/components/DemoBanner/DemoBanner';
import { useAuth } from '@/context/AuthContext';
import { DESTINATIONS } from '@/data/destinations';
import { getDestinationImage } from '@/lib/destinationImage';

import styles from './page.module.scss';

const FEATURES = [
  {
    title: 'Real Flights',
    desc: 'Live prices from Google Flights. Compares options and picks the best value for your budget.',
    color: 'ocean' as const,
  },
  {
    title: 'Hotel Search',
    desc: 'Searches Google Hotels by location, dates, and star rating within your price range.',
    color: 'sand' as const,
  },
  {
    title: 'Local Experiences',
    desc: 'Discovers restaurants, tours, and local favorites via Google Places.',
    color: 'lagoon' as const,
  },
  {
    title: 'Budget-Aware',
    desc: 'Tracks spending across every category. Never goes over your limit.',
    color: 'sunset' as const,
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Describe your trip',
    desc: 'Tell the concierge where, when, and your budget.',
    color: 'ocean' as const,
  },
  {
    num: '02',
    title: 'Agent searches',
    desc: 'It calls 3-8 real APIs per turn, reasoning between each.',
    color: 'sand' as const,
  },
  {
    num: '03',
    title: 'Review & iterate',
    desc: 'Refine conversationally until the itinerary is perfect.',
    color: 'lagoon' as const,
  },
];

const HERO_DESTINATIONS = DESTINATIONS.slice(0, 5);

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace('/trips');
    }
  }, [user, router]);

  return (
    <div className={styles.landing}>
      <DemoBanner />

      {/* -- Hero (full-bleed, split editorial) -- */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={styles.overline}>Portfolio demo</span>
          <h1 className={styles.headline}>
            An agentic trip planner{' '}
            <em className={styles.headlineAccent}>built with Claude</em>
          </h1>
          <p className={styles.heroBody}>
            Multi-step AI concierge that searches real flights, hotels, and
            experiences within your budget. Grounded in live API data from
            SerpApi and Google Places.
          </p>
          <div className={styles.heroCtas}>
            <Link href='/register' className={styles.primaryCta}>
              Try the chat demo
            </Link>
            <Link href='/explore' className={styles.secondaryCta}>
              Explore Destinations
            </Link>
          </div>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.destinationGrid}>
            {HERO_DESTINATIONS.map((dest) => {
              const { url } = getDestinationImage(dest.name);
              return (
                <Link
                  key={dest.slug}
                  href={`/explore/${dest.slug}`}
                  className={styles.destCard}
                >
                  <div className={styles.destCardImage}>
                    {url ? (
                      <Image
                        src={url}
                        alt={dest.name}
                        fill
                        sizes='200px'
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className={styles.destCardFallback} />
                    )}
                  </div>
                  <div className={styles.destCardInfo}>
                    <span className={styles.destCardName}>{dest.name}</span>
                    <span className={styles.destCardPrice}>
                      {'$'.repeat(dest.price_level)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* -- How it works -- */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>
          Three steps to your perfect trip
        </h2>
        <p className={styles.sectionSubtitle}>
          Describe your dream trip, let AI search real APIs, then refine until
          it is perfect.
        </p>
        <div className={styles.steps}>
          {STEPS.map((step) => (
            <div key={step.num} className={styles.step}>
              <span className={`${styles.stepNum} ${styles[step.color]}`}>
                {step.num}
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -- Features -- */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Real data. Real decisions.</h2>
        <p className={styles.sectionSubtitle}>
          Grounded in live API data. Every recommendation is pulled from real
          flight, hotel, and experience searches at the moment you ask.
        </p>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.feature}>
              <div className={`${styles.featureIcon} ${styles[f.color]}`} />
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -- Explore Destinations -- */}
      <section className={styles.exploreSection}>
        <h2 className={styles.sectionTitle}>Explore Destinations</h2>
        <p className={styles.sectionSubtitle}>
          Browse 30 destination travel guides with local tips, dining
          recommendations, and destination research.
        </p>
        <Link href='/explore' className={styles.exploreCta}>
          Discover destinations
        </Link>
      </section>

      {/* -- Final CTA -- */}
      <section className={styles.finalCta}>
        <h2>
          <em>Want to try it?</em>
        </h2>
        <p>
          Voyager is a portfolio demonstration of an agentic AI travel planning
          pattern. Register a free account and run the demo end to end.
        </p>
        <Link href='/register' className={styles.primaryCta}>
          Try the live demo
        </Link>
      </section>
    </div>
  );
}
