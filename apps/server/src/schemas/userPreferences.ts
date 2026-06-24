/**
 * User preferences model: option constants, wizard steps, the UserPreferences
 * type, and normalization that migrates legacy persisted shapes to the current
 * schema version. Single source of truth for preference shape and defaults.
 */
import { z } from 'zod';

// --- Option constants (shared with client via @repo/types) ---

export {
  ACCOMMODATION_OPTIONS,
  ACTIVITY_OPTIONS,
  BUDGET_COMFORT_OPTIONS,
  DIETARY_OPTIONS,
  DINING_STYLE_OPTIONS,
  TRAVEL_PACE_OPTIONS,
  TRAVEL_PARTY_OPTIONS,
} from '@repo/types';

// --- Wizard steps ---

export const WIZARD_STEPS = [
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'travel_pace', label: 'Travel Pace' },
  { id: 'dining', label: 'Dining' },
  { id: 'activities', label: 'Activities' },
  { id: 'travel_party', label: 'Travel Party' },
  { id: 'budget_comfort', label: 'Budget' },
] as const;

// --- Types ---

export interface UserPreferences {
  schema_version: number;
  accommodation: 'budget' | 'mid-range' | 'upscale' | 'unique' | null;
  travel_pace: 'relaxed' | 'moderate' | 'packed' | null;
  dietary: string[];
  dining_style: 'street-food' | 'casual' | 'fine-dining' | 'food-tours' | null;
  activities: string[];
  travel_party:
    | 'solo'
    | 'romantic-partner'
    | 'friends'
    | 'family-with-kids'
    | 'family-adults'
    | null;
  budget_comfort:
    | 'budget-conscious'
    | 'value-seeker'
    | 'comfort-first'
    | 'no-concerns'
    | null;
  completed_steps: string[];
  lgbtq_safety: boolean;
  gender: 'prefer_not_to_say' | 'woman' | 'man' | 'non_binary' | null;
}

// Validates an inbound preferences update at the API edge: known fields only
// (unknown keys are stripped), each value constrained to its allowed set. All
// fields optional so a partial update is valid; malformed values are rejected.
export const userPreferencesUpdateSchema = z.object({
  schema_version: z.number().int().optional(),
  accommodation: z
    .enum(['budget', 'mid-range', 'upscale', 'unique'])
    .nullable()
    .optional(),
  travel_pace: z.enum(['relaxed', 'moderate', 'packed']).nullable().optional(),
  dietary: z.array(z.string()).optional(),
  dining_style: z
    .enum(['street-food', 'casual', 'fine-dining', 'food-tours'])
    .nullable()
    .optional(),
  activities: z.array(z.string()).optional(),
  travel_party: z
    .enum([
      'solo',
      'romantic-partner',
      'friends',
      'family-with-kids',
      'family-adults',
    ])
    .nullable()
    .optional(),
  budget_comfort: z
    .enum(['budget-conscious', 'value-seeker', 'comfort-first', 'no-concerns'])
    .nullable()
    .optional(),
  completed_steps: z.array(z.string()).optional(),
  lgbtq_safety: z.boolean().optional(),
  gender: z
    .enum(['prefer_not_to_say', 'woman', 'man', 'non_binary'])
    .nullable()
    .optional(),
});

export const CURRENT_PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES: UserPreferences = {
  schema_version: CURRENT_PREFERENCES_VERSION,
  accommodation: null,
  travel_pace: null,
  dietary: [],
  dining_style: null,
  activities: [],
  travel_party: null,
  budget_comfort: null,
  completed_steps: [],
  lgbtq_safety: false,
  gender: null,
};

// --- Legacy value mapping ---

const LEGACY_SOCIAL_MAP: Record<string, string> = {
  couple: 'romantic-partner',
  group: 'friends',
  family: 'family-with-kids',
  solo: 'solo',
};

// --- Normalize ---

function detectSchemaVersion(data: Record<string, unknown>): number {
  if (typeof data.schema_version === 'number') return data.schema_version;
  if (typeof data.version === 'number') return data.version;
  return 0;
}

function migrateV0ToV1(
  data: Record<string, unknown>,
): Partial<UserPreferences> {
  return {
    dietary: Array.isArray(data.dietary) ? (data.dietary as string[]) : [],
    travel_pace:
      typeof data.intensity === 'string'
        ? (data.intensity as UserPreferences['travel_pace'])
        : null,
    travel_party:
      typeof data.social === 'string'
        ? ((LEGACY_SOCIAL_MAP[
            data.social
          ] as UserPreferences['travel_party']) ?? null)
        : null,
  };
}

export function normalizePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PREFERENCES };
  }

  const data = raw as Record<string, unknown>;
  const version = detectSchemaVersion(data);

  if (version < 1) {
    return { ...DEFAULT_PREFERENCES, ...migrateV0ToV1(data) };
  }

  return {
    schema_version: CURRENT_PREFERENCES_VERSION,
    accommodation:
      (data.accommodation as UserPreferences['accommodation']) ?? null,
    travel_pace: (data.travel_pace as UserPreferences['travel_pace']) ?? null,
    dietary: Array.isArray(data.dietary) ? (data.dietary as string[]) : [],
    dining_style:
      (data.dining_style as UserPreferences['dining_style']) ?? null,
    activities: Array.isArray(data.activities)
      ? (data.activities as string[])
      : [],
    travel_party:
      (data.travel_party as UserPreferences['travel_party']) ?? null,
    budget_comfort:
      (data.budget_comfort as UserPreferences['budget_comfort']) ?? null,
    completed_steps: Array.isArray(data.completed_steps)
      ? (data.completed_steps as string[])
      : [],
    lgbtq_safety: data.lgbtq_safety === true,
    gender: (data.gender as UserPreferences['gender']) ?? null,
  };
}
