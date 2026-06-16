'use client';

/**
 * Collapsible per-day itinerary view that groups trip activities by date, letting
 * users expand and scan a multi-day schedule one day at a time.
 */
import { useState } from 'react';

import * as Collapsible from '@radix-ui/react-collapsible';

import styles from './DailySchedule.module.scss';

export interface ScheduleItem {
  id: string;
  time_of_day: string;
  title: string;
  description: string | null;
  item_type: string;
  item_order: number;
  place_id: string | null;
  booking_url: string | null;
  price_usd: string | null;
}

export interface ScheduleDay {
  id: string;
  day_number: number;
  day_date: string;
  items: ScheduleItem[];
}

interface DailyScheduleProps {
  days: ScheduleDay[];
}

function DayCard({ day }: { day: ScheduleDay }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={styles.dayCard}
    >
      <Collapsible.Trigger asChild>
        <button
          type='button'
          className={styles.dayHeading}
          aria-expanded={open}
        >
          Day {day.day_number} - {day.day_date}
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content className={styles.dayContent}>
        <ul className={styles.itemList}>
          {day.items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.timeTag}>{item.time_of_day}</span>
              <span className={styles.itemTitle}>{item.title}</span>
              {item.description && (
                <p className={styles.itemDesc}>{item.description}</p>
              )}
            </li>
          ))}
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function DailySchedule({ days }: DailyScheduleProps) {
  if (days.length === 0) {
    return <p className={styles.empty}>No schedule planned yet.</p>;
  }
  return (
    <div className={styles.root}>
      {days.map((day) => (
        <DayCard key={day.id} day={day} />
      ))}
    </div>
  );
}
