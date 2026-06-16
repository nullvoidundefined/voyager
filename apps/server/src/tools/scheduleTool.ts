/**
 * Daily-schedule tool handler: persists the agent's day-by-day itinerary by
 * upserting each schedule day and inserting its activity items. Takes an
 * adapters object so the executor injects real repository writes and tests
 * inject doubles, keeping the handler free of direct database coupling.
 */
import type {
  AddItemInput,
  ScheduleDay,
  ScheduleItem,
  UpsertDayInput,
} from 'app/repositories/trips/scheduleRepository.js';

import type { ToolContext } from './executor.js';

export interface ScheduleAdapters {
  upsertScheduleDay: (
    tripId: string,
    input: UpsertDayInput,
  ) => Promise<ScheduleDay>;
  addScheduleItem: (
    scheduleId: string,
    input: AddItemInput,
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
  for (const day of input.days) {
    const scheduleDay = await adapters.upsertScheduleDay(ctx.tripId, {
      day_date: day.day_date,
      day_number: day.day_number,
    });
    for (const item of day.items) {
      await adapters.addScheduleItem(scheduleDay.id, item);
    }
  }
  return { days_planned: input.days.length };
}
