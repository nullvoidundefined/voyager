/**
 * discover_destinations logic: ranks the curated catalog by soft travel
 * criteria (vibe, budget, month, climate) and returns the best matches as
 * generic Offers for a destination offer_tiles node. Pure and deterministic:
 * no network, no SerpApi, curated data only.
 */
import type { Offer } from '@repo/types';

import type { Destination } from 'app/data/loadDestinations.js';
import { loadDestinations } from 'app/data/loadDestinations.js';
import { isMonthInBestSeason } from 'app/services/seasonMatch.js';

export type Climate = 'cold' | 'mild' | 'warm';

export interface DiscoverDestinationsInput {
  climate?: Climate;
  limit?: number;
  max_daily_budget_usd?: number;
  max_price_level?: 1 | 2 | 3 | 4;
  month?: string;
  vibes?: string[];
}

export interface DiscoverDestinationsResult {
  destinations: Offer[];
  status: 'no_results' | 'ok';
}

const DEFAULT_LIMIT = 5;
const WARM_HIGH_C = 24;
const COLD_HIGH_C = 15;
const VIBE_MATCH_SCORE = 2;
const SEASON_MATCH_SCORE = 1;

export function discoverDestinations(
  input: DiscoverDestinationsInput,
): DiscoverDestinationsResult {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const survivors = loadDestinations().filter((d) =>
    passesHardFilters(d, input),
  );
  if (survivors.length === 0) return { destinations: [], status: 'no_results' };

  const ranked = survivors
    .map((d) => ({ destination: d, score: scoreDestination(d, input) }))
    .sort(compareRanked)
    .slice(0, limit)
    .map((entry) => toOffer(entry.destination));

  return { destinations: ranked, status: 'ok' };
}

function passesHardFilters(
  destination: Destination,
  input: DiscoverDestinationsInput,
): boolean {
  if (
    input.max_price_level &&
    destination.price_level > input.max_price_level
  ) {
    return false;
  }
  if (
    input.max_daily_budget_usd &&
    destination.estimated_daily_budget.budget > input.max_daily_budget_usd
  ) {
    return false;
  }
  if (
    input.climate &&
    deriveClimate(destination, input.month) !== input.climate
  ) {
    return false;
  }
  return true;
}

function scoreDestination(
  destination: Destination,
  input: DiscoverDestinationsInput,
): number {
  let score = 0;
  for (const vibe of input.vibes ?? []) {
    if (destination.categories.includes(vibe)) score += VIBE_MATCH_SCORE;
  }
  if (
    input.month &&
    isMonthInBestSeason(destination.best_season, input.month)
  ) {
    score += SEASON_MATCH_SCORE;
  }
  return score;
}

function compareRanked(
  a: { destination: Destination; score: number },
  b: { destination: Destination; score: number },
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.destination.price_level !== b.destination.price_level) {
    return a.destination.price_level - b.destination.price_level;
  }
  return a.destination.name.localeCompare(b.destination.name);
}

function deriveClimate(destination: Destination, month?: string): Climate {
  const highs = destination.weather.map((w) => w.high_c);
  const referenceHigh = month
    ? (destination.weather.find(
        (w) => w.month.toLowerCase() === month.toLowerCase(),
      )?.high_c ?? averageOf(highs))
    : averageOf(highs);
  if (referenceHigh >= WARM_HIGH_C) return 'warm';
  if (referenceHigh < COLD_HIGH_C) return 'cold';
  return 'mild';
}

function averageOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toOffer(destination: Destination): Offer {
  return {
    badges: [destination.best_season, ...destination.categories.slice(0, 2)],
    currency: 'USD',
    detail: {
      best_season: destination.best_season,
      daily_budget_mid: destination.estimated_daily_budget.mid,
      price_level: destination.price_level,
    },
    id: destination.slug,
    price: destination.estimated_daily_budget.budget,
    price_unit: 'per_day',
    selection_label: destination.name,
    subtitle: destination.country,
    title: destination.name,
  };
}
