/**
 * Matches a calendar month against a destination's curated best_season
 * string. best_season values are free-text ranges ("March - May",
 * "November - April") or the literal "Year-round", never a single month, so
 * a plain substring check only ever matches a range's boundary months. This
 * parses the range into month indices and tests inclusive membership,
 * handling ranges that wrap across the December/January boundary.
 */
const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const YEAR_ROUND = 'year-round';

export function isMonthInBestSeason(
  bestSeason: string,
  month: string,
): boolean {
  if (bestSeason.trim().toLowerCase() === YEAR_ROUND) return true;

  const monthIndex = monthNameToIndex(month);
  if (monthIndex === undefined) return false;

  const range = parseSeasonRange(bestSeason);
  if (range === undefined) return false;

  const { end, start } = range;
  if (start <= end) return monthIndex >= start && monthIndex <= end;
  return monthIndex >= start || monthIndex <= end;
}

function parseSeasonRange(
  bestSeason: string,
): { start: number; end: number } | undefined {
  const parts = bestSeason.split('-').map((part) => part.trim());
  if (parts.length !== 2) return undefined;

  const start = monthNameToIndex(parts[0] ?? '');
  const end = monthNameToIndex(parts[1] ?? '');
  if (start === undefined || end === undefined) return undefined;

  return { end, start };
}

function monthNameToIndex(month: string): number | undefined {
  const index = MONTH_NAMES.indexOf(month.trim().toLowerCase());
  return index === -1 ? undefined : index;
}
