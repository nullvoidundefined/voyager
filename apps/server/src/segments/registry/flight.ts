/** Flight segment capability: legacy flight sub-agent wiring as registry data. */
import { flightToOffer } from 'app/segments/offerMappers/flightToOffer.js';
import type { SegmentCapability } from 'app/segments/segmentCapability.js';

export const flightCapability: SegmentCapability = {
  buildSearchKeys: (params) => ({
    region: String(params.destination ?? '').toLowerCase(),
    routeKey:
      `${String(params.origin ?? '')}->${String(params.destination ?? '')}`.toLowerCase(),
  }),
  kind: 'flight',
  label: 'Flight',
  planCategoryId: 'flights',
  requiredTools: ['search_flights'],
  resultListKey: 'flights',
  searchTool: 'search_flights',
  selectionKey: 'flights',
  selectTool: 'select_flight',
  subAgentTools: [
    'search_flights',
    'get_destination_info',
    'select_flight',
    'calculate_remaining_budget',
    // SEC-01-adjacent + ORC-01: legs are flight segments, so the flight
    // sub-agent needs to add/remove/reorder them during multi-city planning.
    'add_leg',
    'remove_leg',
    'reorder_legs',
    'format_response',
  ],
  tileKind: 'flight',
  toOffer: flightToOffer,
};
