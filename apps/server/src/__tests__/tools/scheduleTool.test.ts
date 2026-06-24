import { describe, expect, it, vi } from 'vitest';

import { handlePlanDailySchedule } from 'app/tools/scheduleTool.js';

const mockUpsert = vi.fn().mockResolvedValue({
  id: 'day-1',
  day_number: 1,
  day_date: '2026-08-01',
  trip_id: 'trip-1',
  created_at: '2026-01-01T00:00:00Z',
  items: [],
});
const mockAddItem = vi
  .fn()
  .mockResolvedValue({ id: 'item-1', title: 'Museum visit' });

// Pass-through transaction runner: invokes the body with a sentinel client so
// the test can assert the writes are threaded through one transaction.
const TX_CLIENT = { tx: true };
const mockRunInTransaction = vi.fn((fn) => fn(TX_CLIENT));

describe('plan_daily_schedule tool', () => {
  it('upserts each day and adds each item inside one transaction', async () => {
    const result = await handlePlanDailySchedule(
      {
        days: [
          {
            day_number: 1,
            day_date: '2026-08-01',
            items: [
              {
                time_of_day: 'morning',
                title: 'Museum visit',
                item_type: 'activity',
                item_order: 1,
              },
            ],
          },
        ],
      },
      { tripId: 'trip-1', userId: 'user-1' },
      {
        runInTransaction: mockRunInTransaction,
        upsertScheduleDay: mockUpsert,
        addScheduleItem: mockAddItem,
      },
    );
    expect(mockRunInTransaction).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ day_number: 1 }),
      TX_CLIENT,
    );
    expect(mockAddItem).toHaveBeenCalledWith(
      'day-1',
      expect.objectContaining({ title: 'Museum visit' }),
      TX_CLIENT,
    );
    expect(result.days_planned).toBe(1);
  });
});
