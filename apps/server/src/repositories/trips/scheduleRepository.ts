/**
 * Schedule data access for a trip's day-by-day itinerary. Persists and reads
 * schedule items so the planned timeline is stored separately from the trip's
 * top-level booking records.
 */
import { query } from 'app/database/pool.js';

export interface ScheduleItem {
  id: string;
  schedule_id: string;
  time_of_day: string;
  title: string;
  description: string | null;
  item_type: string;
  item_order: number;
  place_id: string | null;
  booking_url: string | null;
  price_usd: string | null;
  created_at: string;
}

export interface ScheduleDay {
  id: string;
  trip_id: string;
  day_date: string;
  day_number: number;
  created_at: string;
  items: ScheduleItem[];
}

export interface UpsertDayInput {
  day_date: string;
  day_number: number;
}

export interface AddItemInput {
  time_of_day: string;
  title: string;
  description?: string;
  item_type: string;
  item_order: number;
  place_id?: string;
  booking_url?: string;
  price_usd?: number;
}

export async function upsertScheduleDay(
  tripId: string,
  input: UpsertDayInput,
): Promise<ScheduleDay> {
  const result = await query<Omit<ScheduleDay, 'items'>>(
    `INSERT INTO trip_schedule (trip_id, day_date, day_number)
     VALUES ($1, $2, $3)
     ON CONFLICT (trip_id, day_number) DO UPDATE SET day_date = EXCLUDED.day_date
     RETURNING *`,
    [tripId, input.day_date, input.day_number],
  );
  return { ...result.rows[0]!, items: [] };
}

export async function addScheduleItem(
  scheduleId: string,
  input: AddItemInput,
): Promise<ScheduleItem> {
  const result = await query<ScheduleItem>(
    `INSERT INTO trip_schedule_items
     (schedule_id, time_of_day, title, description, item_type, item_order, place_id, booking_url, price_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      scheduleId,
      input.time_of_day,
      input.title,
      input.description ?? null,
      input.item_type,
      input.item_order,
      input.place_id ?? null,
      input.booking_url ?? null,
      input.price_usd ?? null,
    ],
  );
  return result.rows[0]!;
}

export async function getScheduleForTrip(
  tripId: string,
): Promise<ScheduleDay[]> {
  const result = await query<ScheduleDay>(
    `SELECT s.*,
       COALESCE(
         json_agg(i ORDER BY i.item_order) FILTER (WHERE i.id IS NOT NULL),
         '[]'
       ) AS items
     FROM trip_schedule s
     LEFT JOIN trip_schedule_items i ON i.schedule_id = s.id
     WHERE s.trip_id = $1
     GROUP BY s.id
     ORDER BY s.day_number`,
    [tripId],
  );
  return result.rows;
}
