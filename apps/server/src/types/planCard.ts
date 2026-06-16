/**
 * Shared TypeScript types for the trip plan card and its experience interests.
 * Central type definitions consumed by prompt builders and handlers so the
 * plan card shape stays consistent across the server.
 */

export type ExperienceInterest =
  | 'dining'
  | 'nightlife'
  | 'activities'
  | 'theater'
  | 'wellness'
  | 'work';

export type TripPlanCategoryId =
  | 'flights'
  | 'hotels'
  | 'car_rental'
  | 'experiences';

export interface TripPlanCard {
  categories: TripPlanCategory[];
}

export interface TripPlanCategory {
  id: TripPlanCategoryId;
  label: string;
  enabled: boolean;
  not_applicable: boolean;
  not_applicable_reason?: string;
  sub_options?: TripPlanSubOption[];
}

export type TripPlanSubOption =
  | {
      type: 'radio';
      id: string;
      label: string;
      options: Array<{ id: string; label: string }>;
      value: string;
    }
  | {
      type: 'multi';
      id: string;
      label: string;
      options: Array<{ id: string; label: string }>;
      values: string[];
    };

export const EXPERIENCE_INTEREST_OPTIONS: Array<{
  id: ExperienceInterest;
  label: string;
}> = [
  { id: 'dining', label: 'Dining' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'activities', label: 'Activities' },
  { id: 'theater', label: 'Theater & Arts' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'work', label: 'Work-friendly' },
];

export const FLIGHT_TRIP_TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'one_way', label: 'One way' },
  { id: 'round_trip', label: 'Round trip' },
  { id: 'multi_city', label: 'Multi-city' },
];
