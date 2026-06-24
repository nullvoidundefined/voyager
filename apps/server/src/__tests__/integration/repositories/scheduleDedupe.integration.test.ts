import { describe, expect, it } from 'vitest';

import { seedTrip, seedUser } from 'app/__tests__/integration/helpers/seed.js';
import { pool } from 'app/database/pool.js';
import {
  addScheduleItem,
  upsertScheduleDay,
} from 'app/repositories/trips/scheduleRepository.js';

const ITEM = {
  time_of_day: 'morning',
  title: 'Museum visit',
  item_type: 'activity',
  item_order: 1,
};

describe('schedule item dedupe integration', () => {
  it('does not duplicate an item when the same slot is written twice', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);
    const day = await upsertScheduleDay(trip.id, {
      day_date: '2026-08-01',
      day_number: 1,
    });

    await addScheduleItem(day.id, ITEM);
    await addScheduleItem(day.id, { ...ITEM, title: 'Museum visit (updated)' });

    const rows = await pool.query(
      'SELECT title FROM trip_schedule_items WHERE schedule_id = $1 AND item_order = $2',
      [day.id, ITEM.item_order],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].title).toBe('Museum visit (updated)');
  });
});
