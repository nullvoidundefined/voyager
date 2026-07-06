/**
 * Loads and caches the curated destination catalog. The server's source of
 * truth for discovery ranking; reads the JSON asset (copied to dist at build)
 * once and memoizes it so ranking calls never touch the filesystem twice.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PriceLevel } from 'app/schemas/priceLevel.js';

export interface DestinationExperience {
  category: string;
  description: string;
  estimated_cost: number;
  name: string;
}

export interface DestinationDining {
  cuisine: string;
  description: string;
  name: string;
  price_level: PriceLevel;
}

export interface DestinationWeather {
  high_c: number;
  low_c: number;
  month: string;
  rainfall_mm: number;
}

export interface Destination {
  best_season: string;
  categories: string[];
  country: string;
  currency: string;
  description: string;
  dining_highlights: DestinationDining[];
  estimated_daily_budget: { budget: number; luxury: number; mid: number };
  language: string;
  name: string;
  neighborhoods: Array<{ description: string; name: string }>;
  price_level: PriceLevel;
  slug: string;
  top_experiences: DestinationExperience[];
  visa_summary: string;
  weather: DestinationWeather[];
}

let cachedDestinations: Destination[] | null = null;

export function loadDestinations(): Destination[] {
  if (cachedDestinations) return cachedDestinations;
  const dataDir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(dataDir, 'destinations.json'), 'utf-8');
  cachedDestinations = JSON.parse(raw) as Destination[];
  return cachedDestinations;
}
