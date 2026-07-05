/** Car-rental segment capability: legacy ground sub-agent wiring as registry data. */
import type { SegmentCapability } from 'app/segments/segmentCapability.js';

export const carRentalCapability: SegmentCapability = {
  kind: 'car_rental',
  label: 'Car rental',
  planCategoryId: 'car_rental',
  requiredTools: [],
  requires: ['hotel'],
  searchTool: 'search_car_rentals',
  selectTool: 'select_car_rental',
  selectionKey: 'car_rentals',
  subAgentTools: [
    'search_car_rentals',
    'select_car_rental',
    'calculate_remaining_budget',
    'format_response',
  ],
  tileKind: 'car_rental',
};
