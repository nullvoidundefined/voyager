import {
  type CompletionTracker,
  DEFAULT_COMPLETION_TRACKER,
  type TrackerStatus,
  type TripState,
  allCategoriesResolved,
  computeNudge,
  getFlowPosition,
  isResolved,
  needsWork,
  noEngagement,
  normalizeCompletionTracker,
  statusLabel,
  updateCompletionTracker,
} from 'app/prompts/bookingSteps/bookingSteps.js';
import { describe, expect, it } from 'vitest';

const baseTripState: TripState = {
  destination: 'Paris',
  origin: 'JFK',
  departure_date: '2026-06-01',
  return_date: '2026-06-10',
  budget_total: 5000,
  transport_mode: 'flying',
  flights: [],
  hotels: [],
  experiences: [],
  status: 'planning',
};

const confirmedTracker: CompletionTracker = {
  ...DEFAULT_COMPLETION_TRACKER,
  plan_confirmed: true,
};

describe('normalizeCompletionTracker', () => {
  it('returns defaults for null input', () => {
    const result = normalizeCompletionTracker(null);
    expect(result).toEqual(DEFAULT_COMPLETION_TRACKER);
  });

  it('returns defaults for undefined input', () => {
    const result = normalizeCompletionTracker(undefined);
    expect(result).toEqual(DEFAULT_COMPLETION_TRACKER);
  });

  it('migrates v1 BookingState to v3 CompletionTracker', () => {
    const v1 = {
      version: 1,
      flights: { status: 'idle' },
      hotels: { status: 'asking' },
      car_rental: { status: 'presented' },
      experiences: { status: 'done' },
    };
    const result = normalizeCompletionTracker(v1);
    expect(result.version).toBe(3);
    expect(result.flights).toBe('pending');
    expect(result.hotels).toBe('pending');
    expect(result.car_rental).toBe('searching');
    expect(result.experiences).toBe('selected');
    expect(result.plan_confirmed).toBe(false);
    expect(result.experience_interests).toEqual([]);
    expect(result.turns_since_last_progress).toBe(0);
  });

  it('migrates v1 skipped status', () => {
    const v1 = {
      version: 1,
      flights: { status: 'skipped' },
      hotels: { status: 'idle' },
      car_rental: { status: 'idle' },
      experiences: { status: 'idle' },
    };
    const result = normalizeCompletionTracker(v1);
    expect(result.flights).toBe('skipped');
  });

  it('migrates v2 to v3 with plan_confirmed: false and empty experience_interests', () => {
    const v2 = {
      version: 2,
      transport: 'flying',
      flights: 'selected',
      hotels: 'searching',
      car_rental: 'pending',
      experiences: 'pending',
      turns_since_last_progress: 2,
    };
    const result = normalizeCompletionTracker(v2);
    expect(result.version).toBe(3);
    expect(result.flights).toBe('selected');
    expect(result.hotels).toBe('searching');
    expect(result.plan_confirmed).toBe(false);
    expect(result.experience_interests).toEqual([]);
    expect(result.turns_since_last_progress).toBe(2);
  });

  it('passes through valid v3 data', () => {
    const v3: CompletionTracker = {
      version: 3,
      transport: 'flying',
      flights: 'selected',
      hotels: 'searching',
      car_rental: 'not_applicable',
      experiences: 'pending',
      plan_confirmed: true,
      experience_interests: ['dining', 'nightlife'],
      turns_since_last_progress: 2,
    };
    const result = normalizeCompletionTracker(v3);
    expect(result).toEqual(v3);
  });

  it('fills missing fields in v3 data', () => {
    const partial = { version: 3, flights: 'selected' };
    const result = normalizeCompletionTracker(partial);
    expect(result.flights).toBe('selected');
    expect(result.hotels).toBe('pending');
    expect(result.transport).toBe('pending');
    expect(result.plan_confirmed).toBe(false);
    expect(result.experience_interests).toEqual([]);
    expect(result.turns_since_last_progress).toBe(0);
  });

  it('filters non-string values out of experience_interests', () => {
    const raw = {
      version: 3,
      plan_confirmed: true,
      experience_interests: ['dining', 42, null, 'wellness'],
    };
    const result = normalizeCompletionTracker(raw);
    expect(result.experience_interests).toEqual(['dining', 'wellness']);
  });

  it('preserves not_applicable status in v3 data', () => {
    const raw = { version: 3, flights: 'not_applicable', plan_confirmed: true };
    const result = normalizeCompletionTracker(raw);
    expect(result.flights).toBe('not_applicable');
  });
});

describe('getFlowPosition', () => {
  it('returns COMPLETE when trip status is not planning', () => {
    const trip = { ...baseTripState, status: 'saved' };
    expect(getFlowPosition(trip).phase).toBe('COMPLETE');
  });

  it('returns COLLECT_DETAILS when origin is missing', () => {
    const trip = { ...baseTripState, origin: null };
    expect(getFlowPosition(trip).phase).toBe('COLLECT_DETAILS');
  });

  it('returns COLLECT_DETAILS when departure_date is missing', () => {
    const trip = { ...baseTripState, departure_date: null };
    expect(getFlowPosition(trip).phase).toBe('COLLECT_DETAILS');
  });

  it('returns PLANNING when all required fields are present and no tracker', () => {
    expect(getFlowPosition(baseTripState).phase).toBe('PLANNING');
  });

  it('returns PLAN_TRIP when details complete but plan not confirmed', () => {
    expect(
      getFlowPosition(baseTripState, DEFAULT_COMPLETION_TRACKER).phase,
    ).toBe('PLAN_TRIP');
  });

  it('returns PLANNING when plan_confirmed is true', () => {
    expect(getFlowPosition(baseTripState, confirmedTracker).phase).toBe(
      'PLANNING',
    );
  });

  it('returns PLANNING when no tracker provided (backward compat)', () => {
    expect(getFlowPosition(baseTripState).phase).toBe('PLANNING');
  });

  it('returns PLANNING when legacy unknown tracker is passed (backward compat)', () => {
    expect(getFlowPosition(baseTripState, { some: 'old_shape' }).phase).toBe(
      'PLANNING',
    );
  });

  it('allows null return_date for one_way trips', () => {
    const trip = {
      ...baseTripState,
      return_date: null,
      trip_type: 'one_way' as const,
    };
    expect(getFlowPosition(trip, confirmedTracker).phase).toBe('PLANNING');
  });

  it('requires return_date for round trips', () => {
    const trip = { ...baseTripState, return_date: null };
    expect(getFlowPosition(trip, confirmedTracker).phase).toBe(
      'COLLECT_DETAILS',
    );
  });

  it('does not require budget for PLANNING', () => {
    const trip = { ...baseTripState, budget_total: null };
    expect(getFlowPosition(trip, confirmedTracker).phase).toBe('PLANNING');
  });
});

describe('allCategoriesResolved', () => {
  it('returns false when any category is pending', () => {
    expect(allCategoriesResolved(DEFAULT_COMPLETION_TRACKER)).toBe(false);
  });

  it('returns true when all categories are selected or skipped', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'selected',
      hotels: 'selected',
      car_rental: 'skipped',
      experiences: 'selected',
    };
    expect(allCategoriesResolved(tracker)).toBe(true);
  });

  it('returns true when a category is not_applicable', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'not_applicable',
      hotels: 'selected',
      car_rental: 'skipped',
      experiences: 'selected',
    };
    expect(allCategoriesResolved(tracker)).toBe(true);
  });

  it('returns false when a category is searching', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'selected',
      hotels: 'searching',
      car_rental: 'skipped',
      experiences: 'selected',
    };
    expect(allCategoriesResolved(tracker)).toBe(false);
  });
});

describe('updateCompletionTracker', () => {
  it('marks category as searching when search tool is called', () => {
    const tracker = { ...DEFAULT_COMPLETION_TRACKER };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_flights' }], formatResponse: null },
      baseTripState,
    );
    expect(result.flights).toBe('searching');
    expect(result.turns_since_last_progress).toBe(0);
  });

  it('does not overwrite not_applicable with searching', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'not_applicable',
    };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_flights' }], formatResponse: null },
      baseTripState,
    );
    expect(result.flights).toBe('not_applicable');
  });

  it('marks category as selected when trip has selections', () => {
    const tracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'searching' as const,
    };
    const tripWithFlight = { ...baseTripState, flights: [{ id: '1' }] };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'select_flight' }], formatResponse: null },
      tripWithFlight,
    );
    expect(result.flights).toBe('selected');
  });

  it('marks category as skipped when skip_category names it', () => {
    const tracker = { ...DEFAULT_COMPLETION_TRACKER };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [], formatResponse: { skip_category: 'hotels' } },
      baseTripState,
    );
    expect(result.hotels).toBe('skipped');
  });

  it('updates transport when update_trip sets transport_mode', () => {
    const tracker = { ...DEFAULT_COMPLETION_TRACKER };
    const tripDriving = {
      ...baseTripState,
      transport_mode: 'driving' as const,
    };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'update_trip' }], formatResponse: null },
      tripDriving,
    );
    expect(result.transport).toBe('driving');
    expect(result.flights).toBe('skipped');
  });

  it('increments turns_since_last_progress when no status changes', () => {
    const tracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      transport: 'flying' as const,
      turns_since_last_progress: 1,
    };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [], formatResponse: null },
      baseTripState,
    );
    expect(result.turns_since_last_progress).toBe(2);
  });

  it('resets turns_since_last_progress when any status changes', () => {
    const tracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      turns_since_last_progress: 5,
    };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_hotels' }], formatResponse: null },
      baseTripState,
    );
    expect(result.turns_since_last_progress).toBe(0);
  });

  it('preserves plan_confirmed and experience_interests through updates', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      plan_confirmed: true,
      experience_interests: ['dining', 'nightlife'],
    };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_flights' }], formatResponse: null },
      baseTripState,
    );
    expect(result.plan_confirmed).toBe(true);
    expect(result.experience_interests).toEqual(['dining', 'nightlife']);
  });

  describe('re_open_category tool', () => {
    it('sets the specified category back to pending', () => {
      const tracker: CompletionTracker = {
        ...DEFAULT_COMPLETION_TRACKER,
        plan_confirmed: true,
        hotels: 'skipped',
      };
      const result = updateCompletionTracker(
        tracker,
        {
          tool_calls: [
            { tool_name: 're_open_category', input: { category: 'hotels' } },
          ],
          formatResponse: null,
        },
        baseTripState,
      );
      expect(result.hotels).toBe('pending');
    });

    it('sets not_applicable category back to pending', () => {
      const tracker: CompletionTracker = {
        ...DEFAULT_COMPLETION_TRACKER,
        plan_confirmed: true,
        flights: 'not_applicable',
      };
      const result = updateCompletionTracker(
        tracker,
        {
          tool_calls: [
            { tool_name: 're_open_category', input: { category: 'flights' } },
          ],
          formatResponse: null,
        },
        baseTripState,
      );
      expect(result.flights).toBe('pending');
    });

    it('ignores invalid category values', () => {
      const tracker: CompletionTracker = {
        ...DEFAULT_COMPLETION_TRACKER,
        plan_confirmed: true,
        hotels: 'skipped',
      };
      const result = updateCompletionTracker(
        tracker,
        {
          tool_calls: [
            {
              tool_name: 're_open_category',
              input: { category: 'invalid_cat' },
            },
          ],
          formatResponse: null,
        },
        baseTripState,
      );
      expect(result.hotels).toBe('skipped');
    });
  });

  it('does not overwrite selected with searching', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'selected',
    };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_flights' }], formatResponse: null },
      baseTripState,
    );
    expect(result.flights).toBe('selected');
  });

  it('overwrites skipped with searching when search tool fires', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      hotels: 'skipped',
    };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_hotels' }], formatResponse: null },
      baseTripState,
    );
    expect(result.hotels).toBe('searching');
  });
});

describe('needsWork', () => {
  it.each<[TrackerStatus, boolean]>([
    ['pending', true],
    ['searching', true],
    ['selected', false],
    ['skipped', false],
    ['not_applicable', false],
  ])('%s -> %s', (status, expected) => {
    expect(needsWork(status)).toBe(expected);
  });
});

describe('isResolved', () => {
  it.each<[TrackerStatus, boolean]>([
    ['pending', false],
    ['searching', false],
    ['selected', true],
    ['skipped', true],
    ['not_applicable', true],
  ])('%s -> %s', (status, expected) => {
    expect(isResolved(status)).toBe(expected);
  });
});

describe('statusLabel', () => {
  it.each<[TrackerStatus, string]>([
    ['pending', 'Not yet discussed'],
    ['searching', 'Browsing options'],
    ['selected', 'Selected'],
    ['skipped', 'Skipped'],
    ['not_applicable', 'N/A'],
  ])('%s -> %s', (status, expected) => {
    expect(statusLabel(status)).toBe(expected);
  });
});

describe('noEngagement', () => {
  it('returns true when all categories are pending', () => {
    expect(noEngagement(DEFAULT_COMPLETION_TRACKER)).toBe(true);
  });

  it('returns true when categories are pending or skipped', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'skipped',
      car_rental: 'skipped',
    };
    expect(noEngagement(tracker)).toBe(true);
  });

  it('returns false when any category is searching', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'searching',
    };
    expect(noEngagement(tracker)).toBe(false);
  });

  it('returns false when any category is selected', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      hotels: 'selected',
    };
    expect(noEngagement(tracker)).toBe(false);
  });
});

describe('computeNudge', () => {
  it('returns null when turns_since_last_progress < 3', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      turns_since_last_progress: 2,
    };
    expect(computeNudge(tracker)).toBeNull();
  });

  it('mentions pending categories as not discussed', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'selected',
      hotels: 'selected',
      car_rental: 'skipped',
      experiences: 'pending',
      turns_since_last_progress: 3,
    };
    const nudge = computeNudge(tracker);
    expect(nudge).toContain('experiences');
    expect(nudge).toContain("haven't discussed");
  });

  it('mentions searching categories as stalled', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'selected',
      hotels: 'searching',
      car_rental: 'skipped',
      experiences: 'selected',
      turns_since_last_progress: 3,
    };
    const nudge = computeNudge(tracker);
    expect(nudge).toContain('hotels');
    expect(nudge).toContain('pick or skip');
  });

  it('returns null when all categories are resolved', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      flights: 'selected',
      hotels: 'selected',
      car_rental: 'skipped',
      experiences: 'selected',
      turns_since_last_progress: 5,
    };
    expect(computeNudge(tracker)).toBeNull();
  });
});
