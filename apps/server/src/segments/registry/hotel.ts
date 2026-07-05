/** Hotel segment capability: legacy hotel sub-agent wiring as registry data. */
import { hotelToOffer } from 'app/segments/offerMappers/hotelToOffer.js';
import type { SegmentCapability } from 'app/segments/segmentCapability.js';

export const hotelCapability: SegmentCapability = {
  kind: 'hotel',
  label: 'Hotel',
  planCategoryId: 'hotels',
  requiredTools: ['search_hotels'],
  requires: ['flight'],
  resultListKey: 'hotels',
  searchTool: 'search_hotels',
  selectTool: 'select_hotel',
  selectionKey: 'hotels',
  subAgentTools: [
    'search_hotels',
    'get_destination_info',
    'select_hotel',
    'calculate_remaining_budget',
    'format_response',
  ],
  toOffer: hotelToOffer,
  tileKind: 'hotel',
};
