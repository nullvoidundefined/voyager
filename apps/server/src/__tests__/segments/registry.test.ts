import { SEGMENT_KINDS } from '@repo/types';
import { describe, expect, it } from 'vitest';

import {
  SEGMENT_CAPABILITIES,
  getSegmentCapability,
} from 'app/segments/registry/index.js';

describe('segment capability registry', () => {
  it('registers every SegmentKind', () => {
    for (const kind of SEGMENT_KINDS) {
      expect(SEGMENT_CAPABILITIES[kind].kind).toBe(kind);
    }
  });

  it('preserves the legacy tool and selection-key wiring', () => {
    expect(getSegmentCapability('flight')).toMatchObject({
      searchTool: 'search_flights',
      selectTool: 'select_flight',
      selectionKey: 'flights',
      planCategoryId: 'flights',
      label: 'Flight',
    });
    expect(getSegmentCapability('hotel')).toMatchObject({
      searchTool: 'search_hotels',
      selectTool: 'select_hotel',
      selectionKey: 'hotels',
      planCategoryId: 'hotels',
      label: 'Hotel',
      requires: ['flight'],
    });
    expect(getSegmentCapability('car_rental')).toMatchObject({
      searchTool: 'search_car_rentals',
      selectTool: 'select_car_rental',
      selectionKey: 'car_rentals',
      planCategoryId: 'car_rental',
      label: 'Car rental',
      requires: ['hotel'],
    });
    // Routing unblocks experiences after flight (selectSubAgent ladder), but
    // the legacy presentation prose gates them on hotel; both are preserved.
    expect(getSegmentCapability('experience')).toMatchObject({
      searchTool: 'search_experiences',
      selectTool: 'select_experience',
      selectionKey: 'experiences',
      planCategoryId: 'experiences',
      label: 'Experiences',
      requires: ['flight'],
      presentationRequires: ['hotel'],
    });
  });

  it('preserves all legacy sub-agent tool lists verbatim', () => {
    expect(getSegmentCapability('flight').subAgentTools).toEqual([
      'search_flights',
      'get_destination_info',
      'select_flight',
      'calculate_remaining_budget',
      'add_leg',
      'remove_leg',
      'reorder_legs',
      'format_response',
    ]);
    expect(getSegmentCapability('hotel').subAgentTools).toEqual([
      'search_hotels',
      'get_destination_info',
      'select_hotel',
      'calculate_remaining_budget',
      'format_response',
    ]);
    expect(getSegmentCapability('car_rental').subAgentTools).toEqual([
      'search_car_rentals',
      'select_car_rental',
      'calculate_remaining_budget',
      'format_response',
    ]);
    expect(getSegmentCapability('experience').subAgentTools).toEqual([
      'search_experiences',
      'select_experience',
      'calculate_remaining_budget',
      'plan_daily_schedule',
      'format_response',
    ]);
  });

  it('preserves all legacy required-tool lists verbatim', () => {
    expect(getSegmentCapability('flight').requiredTools).toEqual([
      'search_flights',
    ]);
    expect(getSegmentCapability('hotel').requiredTools).toEqual([
      'search_hotels',
    ]);
    expect(getSegmentCapability('car_rental').requiredTools).toEqual([]);
    expect(getSegmentCapability('experience').requiredTools).toEqual([]);
  });
});

describe('buildSearchKeys', () => {
  it('derives normalized knowledge-base keys from search params', () => {
    expect(
      getSegmentCapability('flight').buildSearchKeys({
        origin: 'JFK',
        destination: 'NRT',
      }),
    ).toEqual({ region: 'nrt', routeKey: 'jfk->nrt' });
    expect(
      getSegmentCapability('hotel').buildSearchKeys({ city: 'Barcelona' }),
    ).toEqual({ region: 'barcelona' });
    expect(
      getSegmentCapability('car_rental').buildSearchKeys({
        pickup_location: 'NRT Airport',
      }),
    ).toEqual({ region: 'nrt airport' });
    expect(
      getSegmentCapability('experience').buildSearchKeys({ location: 'Tokyo' }),
    ).toEqual({ region: 'tokyo' });
  });
});
