'use client';

import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { post } from '@/lib/api/api';

import styles from './newTrip.module.scss';

interface Trip {
  id: string;
}

export default function NewTripPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const creating = useRef(false);

  const destination = searchParams.get('destination') || 'New trip';

  useEffect(() => {
    if (creating.current) {
      return;
    }
    creating.current = true;

    // React Strict Mode (enabled by default in Next.js dev) double-
    // invokes effects: mount -> cleanup -> mount. The creating ref
    // prevents the second mount from firing a duplicate POST. But
    // the previous implementation used an `aborted` boolean that
    // the cleanup set to true, which silenced router.replace in
    // the success handler of the FIRST (and only) POST. That left
    // the page stuck on /trips/new permanently.
    //
    // router.replace is safe to call after the Strict Mode cleanup
    // unmount because it operates on the Next.js router singleton,
    // not on component state. We only gate setError behind a
    // mounted ref to avoid a React state-update-on-unmount warning.
    let mounted = true;

    post<{ trip: Trip }>('/trips', { destination })
      .then(({ trip }) => {
        router.replace(`/trips/${trip.id}`);
      })
      .catch(() => {
        if (mounted) {
          setError('Failed to start a new trip. Please try again.');
          creating.current = false;
        }
      });

    return () => {
      mounted = false;
    };
  }, [router, destination]);

  if (error) {
    return (
      <div className={styles.page}>
        <Link href='/trips' className={styles.back}>
          &larr; Back to trips
        </Link>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.spinnerWrap}>
        <div className={styles.spinner} />
        <p>Setting up your trip...</p>
      </div>
    </div>
  );
}
