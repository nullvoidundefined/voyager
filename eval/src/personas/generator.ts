import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Archetype, Persona } from '../types.js';

import { DESTINATIONS, ORIGINS, TEMPLATES } from './templates.js';

const JSON_INDENT = 2;
const MS_PER_DAY = 86_400_000;
const MIN_LEAD_DAYS = 14;
const DEPARTURE_WINDOW_DAYS = 180;
const MIN_GOALS = 2;
const MAX_GOALS = 4;
const BUDGET_ROUNDING = 100;
const EDGE_CASE_VARIANTS = 3;
const EDGE_CASE_TIGHT_BUDGET = 200;
const MIN_TRIP_DAYS = 3;
const MAX_TRIP_DAYS = 14;
const SHUFFLE_OFFSET = 0.5;

const CACHE_PATH = join(
  new URL('.', import.meta.url).pathname,
  '..',
  '..',
  'personas-cache.json',
);

export function loadCachedPersonas(): Persona[] | null {
  if (!existsSync(CACHE_PATH)) return null;
  try {
    const data = readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(data) as Persona[];
  } catch {
    return null;
  }
}

export function saveCachedPersonas(personas: Persona[]): void {
  writeFileSync(
    CACHE_PATH,
    JSON.stringify(personas, null, JSON_INDENT),
    'utf-8',
  );
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - SHUFFLE_OFFSET);
  return shuffled.slice(0, n);
}

function randomFutureDate(withinDays: number): string {
  const now = new Date();
  const offset = randomInt(MIN_LEAD_DAYS, withinDays);
  const date = new Date(now.getTime() + offset * MS_PER_DAY);
  return date.toISOString().split('T')[0]!;
}

function generatePersonaFromTemplate(
  template: (typeof TEMPLATES)[number],
  index: number,
): Persona {
  const destination = pick(DESTINATIONS);
  const origin = pick(ORIGINS);
  const departureDate = randomFutureDate(DEPARTURE_WINDOW_DAYS);
  const tripType = pick(template.trip_type);
  const travelers = randomInt(
    template.travelers_range[0],
    template.travelers_range[1],
  );
  const style = pick(template.communication_styles);
  const goals = pickN(template.goals_pool, randomInt(MIN_GOALS, MAX_GOALS));

  let budget: number | null = null;
  if (template.budget_range) {
    budget = randomInt(template.budget_range[0], template.budget_range[1]);
    budget = Math.round(budget / BUDGET_ROUNDING) * BUDGET_ROUNDING;
  }

  if (template.archetype === 'edge_case') {
    const edgeType = index % EDGE_CASE_VARIANTS;
    if (edgeType === 0) budget = EDGE_CASE_TIGHT_BUDGET;
    else if (edgeType === 1) budget = null;
  }

  let returnDate: string | null = null;
  if (tripType === 'round_trip') {
    const depDate = new Date(departureDate);
    const tripLength = randomInt(MIN_TRIP_DAYS, MAX_TRIP_DAYS);
    const retDate = new Date(depDate.getTime() + tripLength * MS_PER_DAY);
    returnDate = retDate.toISOString().split('T')[0]!;
  }

  const travelParty = pick(template.travel_party);
  const budgetLabel = budget ? `$${budget}` : 'no budget';
  const name = `${travelParty} ${destination} ${budgetLabel}`;

  return {
    archetype: template.archetype,
    budget,
    communication_style: style,
    constraints: template.constraints,
    departure_date: departureDate,
    destination,
    goals,
    name,
    origin,
    return_date: returnDate,
    travel_party: travelParty,
    travelers,
    trip_type: tripType,
  };
}

export function generatePersonas(options?: {
  count?: number;
  archetype?: Archetype;
}): Persona[] {
  let templates = TEMPLATES;

  if (options?.archetype) {
    templates = templates.filter((t) => t.archetype === options.archetype);
  }

  const personas: Persona[] = [];

  for (const template of templates) {
    const count = options?.count
      ? Math.max(1, Math.round(options.count / templates.length))
      : template.personas_per_run;

    for (let i = 0; i < count; i++) {
      personas.push(generatePersonaFromTemplate(template, i));
    }
  }

  if (options?.count && personas.length > options.count) {
    personas.length = options.count;
  }

  return personas;
}
