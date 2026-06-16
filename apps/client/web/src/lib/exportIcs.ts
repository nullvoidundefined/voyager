/**
 * Converts a trip's day-by-day schedule into an .ics calendar file and triggers
 * a browser download. Exists so users can export an itinerary into any calendar
 * app, mapping coarse time-of-day labels to concrete event times.
 */
import { createEvents } from 'ics';

interface ScheduleItem {
  title: string;
  time_of_day: string;
  description?: string | null;
}

interface ScheduleDay {
  day_date: string;
  day_number: number;
  items: ScheduleItem[];
}

const TIME_MAP: Record<string, [number, number]> = {
  morning: [9, 0],
  afternoon: [14, 0],
  evening: [19, 0],
};

export function buildICSContent(
  tripTitle: string,
  days: ScheduleDay[],
): string {
  const events = days.flatMap((day) =>
    day.items.map((item) => {
      const [year, month, date] = day.day_date.split('-').map(Number);
      const [hour, minute] = TIME_MAP[item.time_of_day] ?? [9, 0];
      return {
        title: item.title,
        description: item.description ?? undefined,
        start: [year, month, date, hour, minute] as [
          number,
          number,
          number,
          number,
          number,
        ],
        duration: { hours: 2 },
        calName: tripTitle,
      };
    }),
  );

  const { value, error } = createEvents(events);
  if (error || !value)
    throw new Error(`ICS generation failed: ${String(error)}`);
  return value;
}

export function downloadICS(tripTitle: string, days: ScheduleDay[]): void {
  const content = buildICSContent(tripTitle, days);
  const blob = new Blob([content], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tripTitle.replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
