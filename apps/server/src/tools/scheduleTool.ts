/**
 * Daily-schedule tool handler: persists the agent's day-by-day itinerary by
 * upserting each schedule day and inserting its activity items. Takes an
 * adapters object so the executor injects real repository writes and tests
 * inject doubles, keeping the handler free of direct database coupling.
 */
import type { PoolClient } from 'app/database/pool.js';
import type {
  AddItemInput,
  ScheduleDay,
  ScheduleItem,
  UpsertDayInput,
} from 'app/repositories/trips/scheduleRepository.js';

import type { ToolContext } from './executor.js';

export interface ScheduleAdapters {
  runInTransaction: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
  upsertScheduleDay: (
    tripId: string,
    input: UpsertDayInput,
    client?: PoolClient,
  ) => Promise<ScheduleDay>;
  addScheduleItem: (
    scheduleId: string,
    input: AddItemInput,
    client?: PoolClient,
  ) => Promise<ScheduleItem>;
}

interface DayInput {
  day_number: number;
  day_date: string;
  items: AddItemInput[];
}

export async function handlePlanDailySchedule(
  input: { days: DayInput[] },
  ctx: ToolContext,
  adapters: ScheduleAdapters,
) {
  // One transaction so a day and all its items commit together; a mid-loop
  // failure rolls back rather than leaving a partial itinerary.
  await adapters.runInTransaction(async (client) => {
    for (const day of input.days) {
      const scheduleDay = await adapters.upsertScheduleDay(
        ctx.tripId,
        { day_date: day.day_date, day_number: day.day_number },
        client,
      );
      for (const item of day.items) {
        await adapters.addScheduleItem(scheduleDay.id, item, client);
      }
    }
  });
  return { days_planned: input.days.length };
}
