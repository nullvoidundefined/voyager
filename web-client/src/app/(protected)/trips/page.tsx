'use client';

import { useState } from 'react';

import { AlertDialog } from '@/components/ui/AlertDialog/AlertDialog';
import { del, get } from '@/lib/api';
import { getDestinationImage } from '@/lib/destinationImage';
import { formatCurrency, formatShortDate } from '@/lib/format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';

import styles from './trips.module.scss';

interface Trip {
  id: string;
  destination: string;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  budget_currency: string;
  status: 'planning' | 'saved' | 'archived';
}

function formatDates(
  departure: string | null,
  returnDate: string | null,
): string {
  if (!departure) {
    return 'Dates TBD';
  }
  if (!returnDate) {
    return formatShortDate(departure);
  }
  return `${formatShortDate(departure)} - ${formatShortDate(returnDate)}`;
}

function formatBudget(amount: number | null, currency: string): string {
  if (amount == null) {
    return 'No budget set';
  }
  return formatCurrency(amount, currency);
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TripsPage() {
  const queryClient = useQueryClient();

  const {
    data: trips,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['trips'],
    queryFn: () => get<{ trips: Trip[] }>('/trips').then((r) => r.trips),
  });

  const deleteMutation = useMutation({
    mutationFn: (tripId: string) => del(`/trips/${tripId}`),
    onMutate: async (tripId: string) => {
      await queryClient.cancelQueries({ queryKey: ['trips'] });
      const previous = queryClient.getQueryData<Trip[]>(['trips']);
      queryClient.setQueryData<Trip[]>(['trips'], (old) =>
        old ? old.filter((t) => t.id !== tripId) : [],
      );
      return { previous };
    },
    onError: (_err, _tripId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trips'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  // Guarded delete via Radix AlertDialog. Plan C Task 9 used
  // window.confirm as a minimum viable guardrail; Task 29 upgrades
  // to the shared components/ui/AlertDialog primitive for proper
  // focus trap, aria-modal, and motion-respecting animations.
  const [pendingDeleteTripId, setPendingDeleteTripId] = useState<string | null>(
    null,
  );

  const handleDeleteClick = (e: React.MouseEvent, tripId: string) => {
    e.preventDefault();
    setPendingDeleteTripId(tripId);
  };

  const confirmDelete = () => {
    if (pendingDeleteTripId) {
      deleteMutation.mutate(pendingDeleteTripId);
      setPendingDeleteTripId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>My Trips</h1>
        <Link href='/trips/new' className={styles.newTrip}>
          + New Trip
        </Link>
      </div>

      {isLoading && <p className={styles.loading}>Loading trips...</p>}

      {error && (
        <p className={styles.error}>Failed to load trips. Please try again.</p>
      )}

      {trips && trips.length > 0 && (
        <div className={styles.trips}>
          {trips.map((trip) => {
            const { url } = getDestinationImage(trip.destination);
            return (
              <Link
                key={trip.id}
                href={`/trips/${trip.id}`}
                className={styles.tripCard}
              >
                {url ? (
                  <div className={styles.cardImage}>
                    <Image
                      src={url}
                      alt={trip.destination}
                      fill
                      sizes='(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw'
                      style={{ objectFit: 'cover' }}
                    />
                    <button
                      type='button'
                      className={styles.deleteBtn}
                      aria-label='Delete trip'
                      onClick={(e) => handleDeleteClick(e, trip.id)}
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <div className={styles.cardImageFallback}>
                    <span>{trip.destination}</span>
                    <button
                      type='button'
                      className={styles.deleteBtn}
                      aria-label='Delete trip'
                      onClick={(e) => handleDeleteClick(e, trip.id)}
                    >
                      &times;
                    </button>
                  </div>
                )}
                <div className={styles.tripLink}>
                  <div className={styles.tripInfo}>
                    <h2>{trip.destination}</h2>
                    <p className={styles.dates}>
                      {formatDates(trip.departure_date, trip.return_date)}
                    </p>
                  </div>
                  <div className={styles.tripMeta}>
                    <span className={styles.budget}>
                      {formatBudget(trip.budget_total, trip.budget_currency)}
                    </span>
                    <span className={`${styles.status} ${styles[trip.status]}`}>
                      {statusLabel(trip.status)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {trips && trips.length === 0 && (
        <div className={styles.empty}>
          <p>No trips yet. Start planning your first adventure!</p>
          <Link href='/trips/new' className={styles.newTrip}>
            + New Trip
          </Link>
        </div>
      )}

      <AlertDialog
        open={pendingDeleteTripId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTripId(null);
        }}
        title='Delete this trip?'
        description='This action cannot be undone. The trip, its conversation history, and any saved itinerary items will be permanently removed.'
        confirmLabel='Delete trip'
        cancelLabel='Keep trip'
        onConfirm={confirmDelete}
        destructive
      />
    </div>
  );
}
