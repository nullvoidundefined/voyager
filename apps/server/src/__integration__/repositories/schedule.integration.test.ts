import { describe, expect, it } from 'vitest';

import { pool } from 'app/database/pool.js';
import {
  addScheduleItem,
  getScheduleForTrip,
  upsertScheduleDay,
} from 'app/repositories/trips/scheduleRepository.js';

import { seedTrip, seedUser } from '../helpers/seed.js';

describe('trip_schedule table', () => {
  it('exists with required columns', async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'trip_schedule'
       ORDER BY ordinal_position`,
    );
    const cols = result.rows.map((r: { column_name: string }) => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('trip_id');
    expect(cols).toContain('day_date');
    expect(cols).toContain('day_number');
  });
});

describe('trip_schedule_items table', () => {
  it('exists with required columns', async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'trip_schedule_items'
       ORDER BY ordinal_position`,
    );
    const cols = result.rows.map((r: { column_name: string }) => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('schedule_id');
    expect(cols).toContain('time_of_day');
    expect(cols).toContain('title');
    expect(cols).toContain('description');
    expect(cols).toContain('item_type');
    expect(cols).toContain('item_order');
  });
});

describe('ScheduleRepository', () => {
  let tripId: string;

  it('setup: seed a user and trip', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);
    tripId = trip.id;
  });

  it('upsertScheduleDay creates a day row', async () => {
    const day = await upsertScheduleDay(tripId, {
      day_date: '2026-08-01',
      day_number: 1,
    });
    expect(day.id).toBeTruthy();
    expect(day.day_number).toBe(1);
  });

  it('upsertScheduleDay is idempotent (upsert on conflict)', async () => {
    const day1 = await upsertScheduleDay(tripId, {
      day_date: '2026-08-01',
      day_number: 1,
    });
    const day2 = await upsertScheduleDay(tripId, {
      day_date: '2026-08-02',
      day_number: 1,
    });
    expect(day1.id).toBe(day2.id);
    // pg returns DATE as a JS Date (midnight local time); the upsert updated the row.
    // Assert the two returned day_dates differ (not the same object) to confirm the update ran.
    expect(String(day2.day_date)).not.toBe(String(day1.day_date));
  });

  it('addScheduleItem adds an item to a day', async () => {
    const day = await upsertScheduleDay(tripId, {
      day_date: '2026-08-01',
      day_number: 1,
    });
    const item = await addScheduleItem(day.id, {
      time_of_day: 'morning',
      title: 'Visit Museum',
      description: 'Explore the local art museum.',
      item_type: 'activity',
      item_order: 1,
    });
    expect(item.id).toBeTruthy();
    expect(item.title).toBe('Visit Museum');
  });

  it('getScheduleForTrip returns days with items', async () => {
    const schedule = await getScheduleForTrip(tripId);
    expect(schedule.length).toBeGreaterThan(0);
    expect(Array.isArray(schedule[0]!.items)).toBe(true);
    const itemTitles = schedule.flatMap((d) => d.items.map((i) => i.title));
    expect(itemTitles).toContain('Visit Museum');
  });
});
