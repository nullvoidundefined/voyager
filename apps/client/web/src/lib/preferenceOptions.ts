/**
 * Re-exports shared preference option constants and holds the client-only wizard
 * step ordering plus the looser client UserPreferences type. Exists so import
 * sites keep one entry point while UI-specific concerns stay on the client.
 */

// Option constants now live in @voyager/shared-types.
// Re-exported here for backwards compatibility with existing import sites.
export {
  ACCOMMODATION_OPTIONS,
  ACTIVITY_OPTIONS,
  BUDGET_COMFORT_OPTIONS,
  DIETARY_OPTIONS,
  DINING_STYLE_OPTIONS,
  GENDER_OPTIONS,
  TRAVEL_PACE_OPTIONS,
  TRAVEL_PARTY_OPTIONS,
} from '@voyager/shared-types';

// WIZARD_STEPS is client-only (UI step ordering) and stays here.
export const WIZARD_STEPS = [
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'travel_pace', label: 'Travel Pace' },
  { id: 'dining', label: 'Dining' },
  { id: 'activities', label: 'Activities' },
  { id: 'travel_party', label: 'Travel Party' },
  { id: 'budget_comfort', label: 'Budget' },
] as const;

// UserPreferences interface stays here because the client uses a looser type
// (version: number, string fields) that differs from the server's strict variant.
export interface UserPreferences {
  version: number;
  accommodation: string | null;
  travel_pace: string | null;
  dietary: string[];
  dining_style: string | null;
  activities: string[];
  travel_party: string | null;
  budget_comfort: string | null;
  completed_steps: string[];
  lgbtq_safety: boolean;
  gender: string | null;
}
