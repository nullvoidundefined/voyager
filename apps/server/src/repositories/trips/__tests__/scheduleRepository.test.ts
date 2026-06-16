import { beforeEach, describe, expect, it, vi } from 'vitest';

import { query } from 'app/database/pool/pool.js';

import {
  addScheduleItem,
  getScheduleForTrip,
  upsertScheduleDay,
} from '../scheduleRepository.js';

vi.mock('app/database/pool/pool.js', () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('upsertScheduleDay', () => {
  it('upserts by (trip_id, day_number) and returns the day with empty items', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'day-1',
          trip_id: 'trip-1',
          day_date: '2026-09-01',
          day_number: 1,
          created_at: '2026-08-30',
        },
      ],
      rowCount: 1,
    } as never);

    const day = await upsertScheduleDay('trip-1', {
      day_date: '2026-09-01',
      day_number: 1,
    });

    const sql = mockQuery.mock.calls[0]![0] as string;
    expect(sql).toContain('INSERT INTO trip_schedule');
    expect(sql).toContain('ON CONFLICT (trip_id, day_number) DO UPDATE');
    expect(sql).toContain('SET day_date = EXCLUDED.day_date');

    const params = mockQuery.mock.calls[0]![1] as unknown[];
    expect(params).toEqual(['trip-1', '2026-09-01', 1]);

    expect(day.id).toBe('day-1');
    expect(day.items).toEqual([]);
  });
});

describe('addScheduleItem', () => {
  it('inserts all 9 columns and returns the row', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'item-1' }],
      rowCount: 1,
    } as never);

    const result = await addScheduleItem('day-1', {
      time_of_day: 'morning',
      title: 'Visit Louvre',
      description: 'Skip-the-line',
      item_type: 'experience',
      item_order: 1,
      place_id: 'p1',
      booking_url: 'https://example.com',
      price_usd: 30,
    });

    const sql = mockQuery.mock.calls[0]![0] as string;
    expect(sql).toContain('INSERT INTO trip_schedule_items');
    expect(sql).toContain('RETURNING *');

    const params = mockQuery.mock.calls[0]![1] as unknown[];
    expect(params).toEqual([
      'day-1',
      'morning',
      'Visit Louvre',
      'Skip-the-line',
      'experience',
      1,
      'p1',
      'https://example.com',
      30,
    ]);
    expect(result.id).toBe('item-1');
  });

  it('defaults optional fields to null', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'item-2' }],
      rowCount: 1,
    } as never);

    await addScheduleItem('day-1', {
      time_of_day: 'afternoon',
      title: 'Free time',
      item_type: 'free',
      item_order: 5,
    });

    const params = mockQuery.mock.calls[0]![1] as unknown[];
    // description, place_id, booking_url, price_usd default to null
    expect(params[3]).toBeNull();
    expect(params[6]).toBeNull();
    expect(params[7]).toBeNull();
    expect(params[8]).toBeNull();
  });
});

describe('getScheduleForTrip', () => {
  it('joins trip_schedule with trip_schedule_items and orders by day_number', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'day-1',
          trip_id: 'trip-1',
          day_date: '2026-09-01',
          day_number: 1,
          items: [],
        },
      ],
      rowCount: 1,
    } as never);

    const result = await getScheduleForTrip('trip-1');

    const sql = mockQuery.mock.calls[0]![0] as string;
    expect(sql).toContain('FROM trip_schedule s');
    expect(sql).toContain('LEFT JOIN trip_schedule_items i');
    expect(sql).toContain('ORDER BY s.day_number');
    expect(sql).toContain('json_agg');
    expect(result).toHaveLength(1);
  });
});
