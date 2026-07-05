/**
 * Re-export shim: the canonical plan-card types live in @repo/types so client
 * and server share one definition. Kept so app/types/planCard.js imports
 * across the server stay stable.
 */
export {
  EXPERIENCE_INTEREST_OPTIONS,
  FLIGHT_TRIP_TYPE_OPTIONS,
} from '@repo/types';
export type {
  ExperienceInterest,
  TripPlanCard,
  TripPlanCategory,
  TripPlanCategoryId,
  TripPlanSubOption,
} from '@repo/types';
