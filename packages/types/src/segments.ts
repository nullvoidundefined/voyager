/**
 * Segment and journey vocabulary: the open unions that drive the server's
 * segment-capability and journey-type registries and the client's offer card
 * registry. Adding a travel mode starts by appending to SEGMENT_KINDS.
 */

export const SEGMENT_KINDS = [
  'flight',
  'hotel',
  'car_rental',
  'experience',
] as const;
// Phase 4 appends: 'cruise', 'train', 'road_route'

export type SegmentKind = (typeof SEGMENT_KINDS)[number];

export type OfferKind = SegmentKind | 'destination';

/** Placeholder alias until Phase 5 introduces real roles ('arrival_at_port'). */
export type SegmentRole = SegmentKind;

export const JOURNEY_TYPE_IDS = ['flight_trip'] as const;
// Phase 4 appends: 'road_trip', 'cruise', 'rail_journey'; Phase 5: 'multi_modal'

export type JourneyTypeId = (typeof JOURNEY_TYPE_IDS)[number];

export interface Offer {
  id: string;
  title: string;
  subtitle?: string;
  /** Legacy-format selection label; falls back to title when absent. */
  selection_label?: string;
  image_url?: string;
  price: number;
  currency: string;
  price_unit?: 'total' | 'per_night' | 'per_day' | 'per_person';
  badges?: string[];
  /** Kind-specific scalar fields; must include every column the segment's
   *  select tool schema and repository insert expect, so the client can echo
   *  them back verbatim on confirm. */
  detail?: Record<string, string | number>;
  booking_url?: string;
  lat?: number;
  lon?: number;
}
