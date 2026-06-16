/** plan_daily_schedule tool: write a day-by-day itinerary for the trip. */
import { z } from 'zod';

import { dateString } from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';

const scheduleItemSchema = z.object({
  time_of_day: z.enum(['morning', 'afternoon', 'evening']),
  title: z.string().min(1),
  description: z.string().optional(),
  item_type: z.enum(['activity', 'meal', 'transport', 'accommodation']),
  item_order: z.number().int().positive(),
  place_id: z.string().max(100).optional(),
  booking_url: z.string().optional(),
  price_usd: z.number().optional(),
});

const scheduleDaySchema = z.object({
  day_number: z.number().int().positive(),
  day_date: dateString.describe('YYYY-MM-DD'),
  items: z.array(scheduleItemSchema),
});

export const planDailyScheduleSchema = z.object({
  days: z.array(scheduleDaySchema),
});

export const planDailyScheduleTool: ToolModule = {
  description:
    'Write a structured day-by-day itinerary for the trip. Call once with all days. Each day has morning/afternoon/evening slots.',
  name: 'plan_daily_schedule',
  schema: planDailyScheduleSchema,
};
