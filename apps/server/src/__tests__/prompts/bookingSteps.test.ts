import type { SegmentKind } from '@repo/types';
import { describe, expect, it } from 'vitest';

import {
  type CompletionTracker,
  DEFAULT_COMPLETION_TRACKER,
  type TrackerStatus,
  type TripState,
  allCategoriesResolved,
  computeNudge,
  getFlowPosition,
  getSegmentStatus,
  isResolved,
  listJourneySegments,
  needsWork,
  noEngagement,
  normalizeCompletionTracker,
  statusLabel,
  updateCompletionTracker,
} from 'app/prompts/bookingSteps.js';

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

/** Tracker with per-segment status overrides on top of the default. */
function segTracker(
  overrides: Partial<Record<SegmentKind, TrackerStatus>>,
  extra?: Partial<Omit<CompletionTracker, 'segments'>>,
): CompletionTracker {
  return {
    ...DEFAULT_COMPLETION_TRACKER,
    ...extra,
    segments: { ...DEFAULT_COMPLETION_TRACKER.segments, ...overrides },
  };
}

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

  it('migrates v1 BookingState to v4 CompletionTracker', () => {
    const v1 = {
      version: 1,
      flights: { status: 'idle' },
      hotels: { status: 'asking' },
      car_rental: { status: 'presented' },
      experiences: { status: 'done' },
    };
    const result = normalizeCompletionTracker(v1);
    expect(result.version).toBe(4);
    expect(result.journeyType).toBe('flight_trip');
    expect(result.segments.flight).toBe('pending');
    expect(result.segments.hotel).toBe('pending');
    expect(result.segments.car_rental).toBe('searching');
    expect(result.segments.experience).toBe('selected');
    expect(result.plan_confirmed).toBe(false);
    expect(result.segment_interests).toEqual({});
    expect(result.turns_since_last_progress).toBe(0);
  });

  it('migrates the v1 DB-default shape (no version key) to v4 under flight_trip', () => {
    // Verbatim column default from 1771879388556_add-booking-state.js
    const v1DbDefault = {
      flights: { status: 'idle' },
      hotels: { status: 'idle' },
      car_rental: { status: 'idle' },
      experiences: { status: 'idle' },
    };
    const result = normalizeCompletionTracker(v1DbDefault);
    expect(result.version).toBe(4);
    expect(result.journeyType).toBe('flight_trip');
    expect(result.segments).toEqual({
      flight: 'pending',
      hotel: 'pending',
      car_rental: 'pending',
      experience: 'pending',
    });
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
    expect(result.segments.flight).toBe('skipped');
  });

  it('migrates v2 to v4 with plan_confirmed: false and empty segment_interests', () => {
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
    expect(result.version).toBe(4);
    expect(result.segments.flight).toBe('selected');
    expect(result.segments.hotel).toBe('searching');
    expect(result.plan_confirmed).toBe(false);
    expect(result.segment_interests).toEqual({});
    expect(result.turns_since_last_progress).toBe(2);
  });

  it('migrates a v3 tracker preserving every status and interest', () => {
    const v3 = {
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
    expect(result).toEqual({
      version: 4,
      journeyType: 'flight_trip',
      transport: 'flying',
      segments: {
        flight: 'selected',
        hotel: 'searching',
        car_rental: 'not_applicable',
        experience: 'pending',
      },
      plan_confirmed: true,
      segment_interests: { experience: ['dining', 'nightlife'] },
      turns_since_last_progress: 2,
    });
  });

  it('passes a valid v4 tracker through unchanged', () => {
    const v4: CompletionTracker = {
      version: 4,
      journeyType: 'flight_trip',
      transport: 'pending',
      segments: { flight: 'selected', hotel: 'pending' },
      plan_confirmed: false,
      segment_interests: {},
      turns_since_last_progress: 0,
    };
    expect(normalizeCompletionTracker(v4)).toEqual(v4);
  });

  it('coerces an unknown journeyType to flight_trip', () => {
    const bad = { version: 4, journeyType: 'teleporting', segments: {} };
    expect(normalizeCompletionTracker(bad).journeyType).toBe('flight_trip');
  });

  it('drops non-status values from v4 segments', () => {
    const raw = {
      version: 4,
      journeyType: 'flight_trip',
      segments: { flight: 'warp_speed', hotel: 'selected' },
    };
    const result = normalizeCompletionTracker(raw);
    expect(result.segments.flight).toBe('pending');
    expect(result.segments.hotel).toBe('selected');
  });

  it('fills missing fields in v3 data', () => {
    const partial = { version: 3, flights: 'selected' };
    const result = normalizeCompletionTracker(partial);
    expect(result.segments.flight).toBe('selected');
    expect(result.segments.hotel).toBe('pending');
    expect(result.transport).toBe('pending');
    expect(result.plan_confirmed).toBe(false);
    expect(result.segment_interests).toEqual({});
    expect(result.turns_since_last_progress).toBe(0);
  });

  it('filters non-string values out of experience interests', () => {
    const raw = {
      version: 3,
      plan_confirmed: true,
      experience_interests: ['dining', 42, null, 'wellness'],
    };
    const result = normalizeCompletionTracker(raw);
    expect(result.segment_interests).toEqual({
      experience: ['dining', 'wellness'],
    });
  });

  it('preserves not_applicable status in v3 data', () => {
    const raw = { version: 3, flights: 'not_applicable', plan_confirmed: true };
    const result = normalizeCompletionTracker(raw);
    expect(result.segments.flight).toBe('not_applicable');
  });
});

describe('tracker segment helpers', () => {
  it('listJourneySegments returns the flight_trip journey order', () => {
    expect(listJourneySegments(DEFAULT_COMPLETION_TRACKER)).toEqual([
      'flight',
      'hotel',
      'experience',
      'car_rental',
    ]);
  });

  it('getSegmentStatus defaults a missing segment to pending', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      segments: {},
    };
    expect(getSegmentStatus(tracker, 'flight')).toBe('pending');
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

  it('routes an undecided trip (no destination) to DISCOVER', () => {
    const trip = { ...baseTripState, destination: '', status: 'planning' };
    expect(getFlowPosition(trip)).toEqual({ phase: 'DISCOVER' });
  });

  it('routes the "New trip" placeholder destination to DISCOVER', () => {
    const trip = {
      ...baseTripState,
      destination: 'New trip',
      status: 'planning',
    };
    expect(getFlowPosition(trip)).toEqual({ phase: 'DISCOVER' });
  });

  it('routes the "Planning..." placeholder destination to DISCOVER', () => {
    const trip = {
      ...baseTripState,
      destination: 'Planning...',
      status: 'planning',
    };
    expect(getFlowPosition(trip)).toEqual({ phase: 'DISCOVER' });
  });

  it('still routes to COLLECT_DETAILS once a destination is chosen', () => {
    const trip = {
      ...baseTripState,
      destination: 'Lisbon',
      origin: null,
      status: 'planning',
    };
    expect(getFlowPosition(trip)).toEqual({ phase: 'COLLECT_DETAILS' });
  });
});

describe('allCategoriesResolved', () => {
  it('returns false when any segment is pending', () => {
    expect(allCategoriesResolved(DEFAULT_COMPLETION_TRACKER)).toBe(false);
  });

  it('returns true when all segments are selected or skipped', () => {
    const tracker = segTracker({
      flight: 'selected',
      hotel: 'selected',
      car_rental: 'skipped',
      experience: 'selected',
    });
    expect(allCategoriesResolved(tracker)).toBe(true);
  });

  it('returns true when a segment is not_applicable', () => {
    const tracker = segTracker({
      flight: 'not_applicable',
      hotel: 'selected',
      car_rental: 'skipped',
      experience: 'selected',
    });
    expect(allCategoriesResolved(tracker)).toBe(true);
  });

  it('returns false when a segment is searching', () => {
    const tracker = segTracker({
      flight: 'selected',
      hotel: 'searching',
      car_rental: 'skipped',
      experience: 'selected',
    });
    expect(allCategoriesResolved(tracker)).toBe(false);
  });
});

describe('updateCompletionTracker', () => {
  it('marks segment as searching when search tool is called', () => {
    const tracker = { ...DEFAULT_COMPLETION_TRACKER };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_flights' }], formatResponse: null },
      baseTripState,
    );
    expect(result.segments.flight).toBe('searching');
    expect(result.turns_since_last_progress).toBe(0);
  });

  it('does not mutate the input tracker segments (defensive clone)', () => {
    const tracker = { ...DEFAULT_COMPLETION_TRACKER };
    updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_flights' }], formatResponse: null },
      baseTripState,
    );
    expect(tracker.segments.flight).toBe('pending');
  });

  it('does not overwrite not_applicable with searching', () => {
    const tracker = segTracker({ flight: 'not_applicable' });
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_flights' }], formatResponse: null },
      baseTripState,
    );
    expect(result.segments.flight).toBe('not_applicable');
  });

  it('marks segment as selected when trip has selections', () => {
    const tracker = segTracker({ flight: 'searching' });
    const tripWithFlight = { ...baseTripState, flights: [{ id: '1' }] };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'select_flight' }], formatResponse: null },
      tripWithFlight,
    );
    expect(result.segments.flight).toBe('selected');
  });

  it('marks segment as skipped when skip_category names it (legacy plural wire value)', () => {
    const tracker = { ...DEFAULT_COMPLETION_TRACKER };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [], formatResponse: { skip_category: 'hotels' } },
      baseTripState,
    );
    expect(result.segments.hotel).toBe('skipped');
  });

  it('maps skip_category "flights" onto the flight segment (wire pin)', () => {
    const result = updateCompletionTracker(
      { ...DEFAULT_COMPLETION_TRACKER },
      { tool_calls: [], formatResponse: { skip_category: 'flights' } },
      baseTripState,
    );
    expect(result.segments.flight).toBe('skipped');
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
    expect(result.segments.flight).toBe('skipped');
  });

  it('increments turns_since_last_progress when no status changes', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      transport: 'flying',
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
    const tracker: CompletionTracker = {
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

  it('preserves plan_confirmed and segment interests through updates', () => {
    const tracker: CompletionTracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      plan_confirmed: true,
      segment_interests: { experience: ['dining', 'nightlife'] },
    };
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_flights' }], formatResponse: null },
      baseTripState,
    );
    expect(result.plan_confirmed).toBe(true);
    expect(result.segment_interests).toEqual({
      experience: ['dining', 'nightlife'],
    });
  });

  describe('re_open_category tool', () => {
    it('sets the specified category back to pending', () => {
      const tracker = segTracker(
        { hotel: 'skipped' },
        { plan_confirmed: true },
      );
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
      expect(result.segments.hotel).toBe('pending');
    });

    it('sets not_applicable category back to pending', () => {
      const tracker = segTracker(
        { flight: 'not_applicable' },
        { plan_confirmed: true },
      );
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
      expect(result.segments.flight).toBe('pending');
    });

    it('maps re_open_category "experiences" onto the experience segment (wire pin)', () => {
      const tracker = segTracker(
        { experience: 'skipped' },
        { plan_confirmed: true },
      );
      const result = updateCompletionTracker(
        tracker,
        {
          tool_calls: [
            {
              tool_name: 're_open_category',
              input: { category: 'experiences' },
            },
          ],
          formatResponse: null,
        },
        baseTripState,
      );
      expect(result.segments.experience).toBe('pending');
    });

    it('ignores invalid category values', () => {
      const tracker = segTracker(
        { hotel: 'skipped' },
        { plan_confirmed: true },
      );
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
      expect(result.segments.hotel).toBe('skipped');
    });
  });

  it('does not overwrite selected with searching', () => {
    const tracker = segTracker({ flight: 'selected' });
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_flights' }], formatResponse: null },
      baseTripState,
    );
    expect(result.segments.flight).toBe('selected');
  });

  it('overwrites skipped with searching when search tool fires', () => {
    const tracker = segTracker({ hotel: 'skipped' });
    const result = updateCompletionTracker(
      tracker,
      { tool_calls: [{ tool_name: 'search_hotels' }], formatResponse: null },
      baseTripState,
    );
    expect(result.segments.hotel).toBe('searching');
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
  it('returns true when all segments are pending', () => {
    expect(noEngagement(DEFAULT_COMPLETION_TRACKER)).toBe(true);
  });

  it('returns true when segments are pending or skipped', () => {
    const tracker = segTracker({ flight: 'skipped', car_rental: 'skipped' });
    expect(noEngagement(tracker)).toBe(true);
  });

  it('returns false when any segment is searching', () => {
    const tracker = segTracker({ flight: 'searching' });
    expect(noEngagement(tracker)).toBe(false);
  });

  it('returns false when any segment is selected', () => {
    const tracker = segTracker({ hotel: 'selected' });
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

  it('mentions pending categories as not discussed with legacy plural labels', () => {
    const tracker = segTracker(
      {
        flight: 'selected',
        hotel: 'selected',
        car_rental: 'skipped',
        experience: 'pending',
      },
      { turns_since_last_progress: 3 },
    );
    const nudge = computeNudge(tracker);
    expect(nudge).toContain('experiences');
    expect(nudge).toContain("haven't discussed");
  });

  it('mentions searching categories as stalled', () => {
    const tracker = segTracker(
      {
        flight: 'selected',
        hotel: 'searching',
        car_rental: 'skipped',
        experience: 'selected',
      },
      { turns_since_last_progress: 3 },
    );
    const nudge = computeNudge(tracker);
    expect(nudge).toContain('hotels');
    expect(nudge).toContain('pick or skip');
  });

  it('uses the space-separated label for car rental', () => {
    const tracker = segTracker(
      {
        flight: 'selected',
        hotel: 'selected',
        car_rental: 'pending',
        experience: 'selected',
      },
      { turns_since_last_progress: 3 },
    );
    expect(computeNudge(tracker)).toContain('car rental');
  });

  it('returns null when all categories are resolved', () => {
    const tracker = segTracker(
      {
        flight: 'selected',
        hotel: 'selected',
        car_rental: 'skipped',
        experience: 'selected',
      },
      { turns_since_last_progress: 5 },
    );
    expect(computeNudge(tracker)).toBeNull();
  });
});
