// Duplicated from server/src/schemas/userPreferences.ts for frontend use.
// Do not import from the server package.

export const ACCOMMODATION_OPTIONS = [
  {
    value: 'budget',
    label: 'Budget',
    description: 'Hostels, budget hotels, basic stays',
  },
  {
    value: 'mid-range',
    label: 'Mid-Range',
    description: '3-star hotels, vacation rentals',
  },
  {
    value: 'upscale',
    label: 'Upscale',
    description: '4-5 star hotels, boutique properties',
  },
  {
    value: 'unique',
    label: 'Unique Stays',
    description: 'Glamping, ryokans, treehouses, eco-lodges',
  },
] as const;

export const TRAVEL_PACE_OPTIONS = [
  {
    value: 'relaxed',
    label: 'Relaxed',
    description: '1-2 activities per day, plenty of downtime',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Balanced mix of activity and rest',
  },
  {
    value: 'packed',
    label: 'Packed',
    description: 'Early mornings, late nights, see everything',
  },
] as const;

export const DIETARY_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'dairy-free', label: 'Dairy-free' },
  { value: 'nut-free', label: 'Nut-free' },
  { value: 'none', label: 'No restrictions' },
] as const;

export const DINING_STYLE_OPTIONS = [
  {
    value: 'street-food',
    label: 'Street Food',
    description: 'Local markets, food stalls, cheap eats',
  },
  {
    value: 'casual',
    label: 'Casual Dining',
    description: 'Local restaurants, cafes, bistros',
  },
  {
    value: 'fine-dining',
    label: 'Fine Dining',
    description: 'Upscale restaurants, tasting menus',
  },
  {
    value: 'food-tours',
    label: 'Food Experiences',
    description: 'Cooking classes, food tours, culinary adventures',
  },
] as const;

export const ACTIVITY_OPTIONS = [
  { value: 'history-culture', label: 'History & Culture' },
  { value: 'nature-outdoors', label: 'Nature & Outdoors' },
  { value: 'beach-water-sports', label: 'Beach & Water Sports' },
  { value: 'nightlife', label: 'Nightlife & Entertainment' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'wellness-spa', label: 'Wellness & Spa' },
  { value: 'adventure-sports', label: 'Adventure Sports' },
  { value: 'art-museums', label: 'Art & Museums' },
  { value: 'photography', label: 'Photography' },
  { value: 'local-experiences', label: 'Local Experiences' },
] as const;

export const TRAVEL_PARTY_OPTIONS = [
  { value: 'solo', label: 'Solo' },
  { value: 'romantic-partner', label: 'Romantic Partner' },
  { value: 'friends', label: 'Friends Group' },
  { value: 'family-with-kids', label: 'Family with Kids' },
  { value: 'family-adults', label: 'Family / Adults' },
] as const;

export const BUDGET_COMFORT_OPTIONS = [
  {
    value: 'budget-conscious',
    label: 'Budget-Conscious',
    description: 'Cheapest options first',
  },
  {
    value: 'value-seeker',
    label: 'Value Seeker',
    description: 'Best bang for the buck',
  },
  {
    value: 'comfort-first',
    label: 'Comfort First',
    description: 'Willing to pay more for convenience',
  },
  {
    value: 'no-concerns',
    label: 'No Budget Concerns',
    description: 'Show me the best',
  },
] as const;

export const WIZARD_STEPS = [
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'travel_pace', label: 'Travel Pace' },
  { id: 'dining', label: 'Dining' },
  { id: 'activities', label: 'Activities' },
  { id: 'travel_party', label: 'Travel Party' },
  { id: 'budget_comfort', label: 'Budget' },
] as const;

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
}
