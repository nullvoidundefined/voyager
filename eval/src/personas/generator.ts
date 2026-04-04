import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { Archetype, Persona } from '../types.js';
import { DESTINATIONS, ORIGINS, TEMPLATES } from './templates.js';

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
  writeFileSync(CACHE_PATH, JSON.stringify(personas, null, 2), 'utf-8');
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomFutureDate(withinDays: number): string {
  const now = new Date();
  const offset = randomInt(14, withinDays);
  const date = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0]!;
}

function generatePersonaFromTemplate(
  template: (typeof TEMPLATES)[number],
  index: number,
): Persona {
  const destination = pick(DESTINATIONS);
  const origin = pick(ORIGINS);
  const departureDate = randomFutureDate(180);
  const tripType = pick(template.trip_type);
  const travelers = randomInt(
    template.travelers_range[0],
    template.travelers_range[1],
  );
  const style = pick(template.communication_styles);
  const goals = pickN(template.goals_pool, randomInt(2, 4));

  let budget: number | null = null;
  if (template.budget_range) {
    budget = randomInt(template.budget_range[0], template.budget_range[1]);
    budget = Math.round(budget / 100) * 100;
  }

  if (template.archetype === 'edge_case') {
    const edgeType = index % 3;
    if (edgeType === 0) budget = 200;
    else if (edgeType === 1) budget = null;
  }

  let returnDate: string | null = null;
  if (tripType === 'round_trip') {
    const depDate = new Date(departureDate);
    const tripLength = randomInt(3, 14);
    const retDate = new Date(
      depDate.getTime() + tripLength * 24 * 60 * 60 * 1000,
    );
    returnDate = retDate.toISOString().split('T')[0]!;
  }

  const travelParty = pick(template.travel_party);
  const budgetLabel = budget ? `$${budget}` : 'no budget';
  const name = `${travelParty} ${destination} ${budgetLabel}`;

  return {
    name,
    archetype: template.archetype,
    destination,
    origin,
    budget,
    departure_date: departureDate,
    return_date: returnDate,
    travelers,
    travel_party: travelParty,
    communication_style: style,
    goals,
    constraints: template.constraints,
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
