/** Car-rental segment capability: legacy ground sub-agent wiring as registry data. */
import { carRentalToOffer } from 'app/segments/offerMappers/carRentalToOffer.js';
import type { SegmentCapability } from 'app/segments/segmentCapability.js';

export const carRentalCapability: SegmentCapability = {
  buildSearchKeys: (params) => ({
    region: String(params.pickup_location ?? '').toLowerCase(),
  }),
  kind: 'car_rental',
  label: 'Car rental',
  planCategoryId: 'car_rental',
  requiredTools: [],
  requires: ['hotel'],
  resultListKey: 'rentals',
  searchTool: 'search_car_rentals',
  selectionKey: 'car_rentals',
  selectTool: 'select_car_rental',
  subAgentTools: [
    'search_car_rentals',
    'select_car_rental',
    'calculate_remaining_budget',
    'format_response',
  ],
  tileKind: 'car_rental',
  toOffer: carRentalToOffer,
};
