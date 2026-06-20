import { describe, expect, it } from 'vitest';

import {
  type CompletionTracker,
  DEFAULT_COMPLETION_TRACKER,
  type TripState,
} from 'app/prompts/bookingSteps.js';
import {
  SUB_AGENT_TOOLS,
  buildDefaultPlanCard,
  selectSubAgent,
} from 'app/services/agent/subAgentService.js';

const baseTripState: TripState = {
  destination: 'New Orleans',
  origin: 'JFK',
  departure_date: '2026-07-01',
  return_date: '2026-07-06',
  budget_total: 3000,
  transport_mode: 'flying',
  trip_type: 'round_trip',
  flights: [],
  hotels: [],
  experiences: [],
  status: 'planning',
};

describe('buildDefaultPlanCard', () => {
  describe('flights category', () => {
    it('enables flights for a standard flying trip', () => {
      const card = buildDefaultPlanCard(baseTripState);
      const flights = card.categories.find((c) => c.id === 'flights')!;
      expect(flights.enabled).toBe(true);
      expect(flights.not_applicable).toBe(false);
    });

    it('marks flights not_applicable for driving trips', () => {
      const trip = { ...baseTripState, transport_mode: 'driving' as const };
      const card = buildDefaultPlanCard(trip);
      const flights = card.categories.find((c) => c.id === 'flights')!;
      expect(flights.enabled).toBe(false);
      expect(flights.not_applicable).toBe(true);
      expect(flights.not_applicable_reason).toBe('Driving trip');
    });

    it('marks flights not_applicable when transport_mode is null but driving', () => {
      const trip = { ...baseTripState, transport_mode: null };
      const card = buildDefaultPlanCard(trip);
      const flights = card.categories.find((c) => c.id === 'flights')!;
      // null transport_mode = unknown, so flights should be enabled
      expect(flights.not_applicable).toBe(false);
    });

    it('pre-selects round_trip in trip_type sub-option', () => {
      const card = buildDefaultPlanCard(baseTripState);
      const flights = card.categories.find((c) => c.id === 'flights')!;
      const tripTypeOpt = flights.sub_options?.find(
        (o) => o.id === 'trip_type',
      );
      expect(tripTypeOpt?.type).toBe('radio');
      if (tripTypeOpt?.type === 'radio') {
        expect(tripTypeOpt.value).toBe('round_trip');
      }
    });

    it('pre-selects one_way in trip_type sub-option for one_way trips', () => {
      const trip = { ...baseTripState, trip_type: 'one_way' as const };
      const card = buildDefaultPlanCard(trip);
      const flights = card.categories.find((c) => c.id === 'flights')!;
      const tripTypeOpt = flights.sub_options?.find(
        (o) => o.id === 'trip_type',
      );
      if (tripTypeOpt?.type === 'radio') {
        expect(tripTypeOpt.value).toBe('one_way');
      }
    });

    it('includes all three trip type options', () => {
      const card = buildDefaultPlanCard(baseTripState);
      const flights = card.categories.find((c) => c.id === 'flights')!;
      const tripTypeOpt = flights.sub_options?.find(
        (o) => o.id === 'trip_type',
      );
      if (tripTypeOpt?.type === 'radio') {
        const ids = tripTypeOpt.options.map((o) => o.id);
        expect(ids).toContain('one_way');
        expect(ids).toContain('round_trip');
        expect(ids).toContain('multi_city');
      }
    });
  });

  describe('hotels category', () => {
    it('enables hotels by default', () => {
      const card = buildDefaultPlanCard(baseTripState);
      const hotels = card.categories.find((c) => c.id === 'hotels')!;
      expect(hotels.enabled).toBe(true);
      expect(hotels.not_applicable).toBe(false);
    });

    it('marks hotels not_applicable for day trips', () => {
      const trip = {
        ...baseTripState,
        departure_date: '2026-07-01',
        return_date: '2026-07-01',
      };
      const card = buildDefaultPlanCard(trip);
      const hotels = card.categories.find((c) => c.id === 'hotels')!;
      expect(hotels.not_applicable).toBe(true);
      expect(hotels.not_applicable_reason).toBe('Day trip');
    });

    it('enables hotels when return_date is null (unknown, not a day trip)', () => {
      const trip = { ...baseTripState, return_date: null };
      const card = buildDefaultPlanCard(trip);
      const hotels = card.categories.find((c) => c.id === 'hotels')!;
      expect(hotels.not_applicable).toBe(false);
    });

    it('has no sub_options', () => {
      const card = buildDefaultPlanCard(baseTripState);
      const hotels = card.categories.find((c) => c.id === 'hotels')!;
      expect(hotels.sub_options).toBeUndefined();
    });
  });

  describe('car_rental category', () => {
    it('is disabled by default', () => {
      const card = buildDefaultPlanCard(baseTripState);
      const car = card.categories.find((c) => c.id === 'car_rental')!;
      expect(car.enabled).toBe(false);
      expect(car.not_applicable).toBe(false);
    });
  });

  describe('experiences category', () => {
    it('is always enabled', () => {
      const card = buildDefaultPlanCard(baseTripState);
      const exp = card.categories.find((c) => c.id === 'experiences')!;
      expect(exp.enabled).toBe(true);
      expect(exp.not_applicable).toBe(false);
    });

    it('includes all six interest options with empty initial selection', () => {
      const card = buildDefaultPlanCard(baseTripState);
      const exp = card.categories.find((c) => c.id === 'experiences')!;
      const interests = exp.sub_options?.find((o) => o.id === 'interests');
      expect(interests?.type).toBe('multi');
      if (interests?.type === 'multi') {
        expect(interests.values).toEqual([]);
        const ids = interests.options.map((o) => o.id);
        expect(ids).toEqual([
          'dining',
          'nightlife',
          'activities',
          'theater',
          'wellness',
          'work',
        ]);
      }
    });
  });

  describe('category ordering', () => {
    it('returns categories in flights, hotels, car_rental, experiences order', () => {
      const card = buildDefaultPlanCard(baseTripState);
      const ids = card.categories.map((c) => c.id);
      expect(ids).toEqual(['flights', 'hotels', 'car_rental', 'experiences']);
    });
  });

  describe('road trip scenario', () => {
    it('marks flights not_applicable and leaves other categories pending', () => {
      const trip = { ...baseTripState, transport_mode: 'driving' as const };
      const card = buildDefaultPlanCard(trip);
      const flights = card.categories.find((c) => c.id === 'flights')!;
      const hotels = card.categories.find((c) => c.id === 'hotels')!;
      const car = card.categories.find((c) => c.id === 'car_rental')!;
      expect(flights.not_applicable).toBe(true);
      expect(hotels.enabled).toBe(true);
      expect(car.enabled).toBe(false); // user must explicitly enable
    });
  });
});

const confirmedTracker: CompletionTracker = {
  ...DEFAULT_COMPLETION_TRACKER,
  plan_confirmed: true,
};

describe('selectSubAgent', () => {
  describe('COLLECT_DETAILS phase', () => {
    it('routes to detail agent', () => {
      expect(
        selectSubAgent(
          { phase: 'COLLECT_DETAILS' },
          DEFAULT_COMPLETION_TRACKER,
        ),
      ).toBe('detail');
    });
  });

  describe('PLAN_TRIP phase', () => {
    it('routes to plan agent', () => {
      expect(
        selectSubAgent({ phase: 'PLAN_TRIP' }, DEFAULT_COMPLETION_TRACKER),
      ).toBe('plan');
    });
  });

  describe('COMPLETE phase', () => {
    it('routes to conversation agent', () => {
      expect(selectSubAgent({ phase: 'COMPLETE' }, confirmedTracker)).toBe(
        'conversation',
      );
    });
  });

  describe('PLANNING phase', () => {
    it('routes to flight agent when flights are pending', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'pending',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('flight');
    });

    it('routes to hotel agent when flights are resolved and hotels are pending', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'selected',
        hotels: 'pending',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('hotel');
    });

    it('routes to hotel agent when flights are skipped and hotels are pending', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'skipped',
        hotels: 'pending',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('hotel');
    });

    it('routes to hotel agent when flights are not_applicable and hotels are pending', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'not_applicable',
        hotels: 'pending',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('hotel');
    });

    it('routes to experience agent when flights+hotels resolved and experiences pending', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'selected',
        hotels: 'selected',
        experiences: 'pending',
        car_rental: 'pending',
      };
      // experiences before ground per spec ordering
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('experience');
    });

    it('routes to ground agent when flights+hotels resolved, experiences resolved, car_rental pending', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'selected',
        hotels: 'selected',
        experiences: 'selected',
        car_rental: 'pending',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('ground');
    });

    it('routes to ground agent when hotels are skipped and car_rental is pending', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'selected',
        hotels: 'skipped',
        experiences: 'selected',
        car_rental: 'pending',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('ground');
    });

    it('routes to conversation agent when all categories are resolved', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'selected',
        hotels: 'selected',
        experiences: 'selected',
        car_rental: 'skipped',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe(
        'conversation',
      );
    });

    it('does not route to hotel when flights are still pending', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'pending',
        hotels: 'pending',
      };
      // flights pending takes priority
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('flight');
    });

    it('does not route to ground when hotels are still pending', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'selected',
        hotels: 'pending',
        car_rental: 'pending',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('hotel');
    });

    it('routes to flight agent when flights are searching (user selecting)', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'searching',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('flight');
    });

    it('routes to hotel agent when hotels are searching and flights resolved', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'selected',
        hotels: 'searching',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('hotel');
    });

    it('routes to experience agent when experiences are searching and flights resolved', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'selected',
        hotels: 'selected',
        experiences: 'searching',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('experience');
    });

    it('routes to ground agent when car_rental is searching and hotels resolved', () => {
      const tracker: CompletionTracker = {
        ...confirmedTracker,
        flights: 'selected',
        hotels: 'selected',
        experiences: 'selected',
        car_rental: 'searching',
      };
      expect(selectSubAgent({ phase: 'PLANNING' }, tracker)).toBe('ground');
    });
  });
});

describe('SUB_AGENT_TOOLS', () => {
  it('detail agent has update_trip and format_response but no search tools', () => {
    expect(SUB_AGENT_TOOLS.detail).toContain('update_trip');
    expect(SUB_AGENT_TOOLS.detail).toContain('format_response');
    expect(SUB_AGENT_TOOLS.detail).not.toContain('search_flights');
    expect(SUB_AGENT_TOOLS.detail).not.toContain('search_hotels');
  });

  it('flight agent has search_flights and select_flight but not search_hotels', () => {
    expect(SUB_AGENT_TOOLS.flight).toContain('search_flights');
    expect(SUB_AGENT_TOOLS.flight).toContain('select_flight');
    expect(SUB_AGENT_TOOLS.flight).not.toContain('search_hotels');
    expect(SUB_AGENT_TOOLS.flight).not.toContain('search_experiences');
  });

  it('hotel agent has search_hotels and select_hotel but not search_flights', () => {
    expect(SUB_AGENT_TOOLS.hotel).toContain('search_hotels');
    expect(SUB_AGENT_TOOLS.hotel).toContain('select_hotel');
    expect(SUB_AGENT_TOOLS.hotel).not.toContain('search_flights');
  });

  it('experience agent has search_experiences but not search_flights', () => {
    expect(SUB_AGENT_TOOLS.experience).toContain('search_experiences');
    expect(SUB_AGENT_TOOLS.experience).toContain('select_experience');
    expect(SUB_AGENT_TOOLS.experience).not.toContain('search_flights');
    expect(SUB_AGENT_TOOLS.experience).not.toContain('search_hotels');
  });

  it('conversation agent has re_open_category', () => {
    expect(SUB_AGENT_TOOLS.conversation).toContain('re_open_category');
    expect(SUB_AGENT_TOOLS.conversation).not.toContain('search_flights');
  });

  it('ORC-01: every executor-implemented leg/schedule tool is in at least one partition', () => {
    const allPartitionedTools = new Set(Object.values(SUB_AGENT_TOOLS).flat());
    expect(allPartitionedTools).toContain('add_leg');
    expect(allPartitionedTools).toContain('remove_leg');
    expect(allPartitionedTools).toContain('reorder_legs');
    expect(allPartitionedTools).toContain('plan_daily_schedule');
  });

  it('ORC-01: flight agent can add/remove/reorder legs for multi-city planning', () => {
    expect(SUB_AGENT_TOOLS.flight).toContain('add_leg');
    expect(SUB_AGENT_TOOLS.flight).toContain('remove_leg');
    expect(SUB_AGENT_TOOLS.flight).toContain('reorder_legs');
  });

  it('ORC-01: experience agent can plan_daily_schedule from confirmed selections', () => {
    expect(SUB_AGENT_TOOLS.experience).toContain('plan_daily_schedule');
  });

  it('ORC-01: conversation agent can edit legs and schedule post-PLANNING', () => {
    expect(SUB_AGENT_TOOLS.conversation).toContain('add_leg');
    expect(SUB_AGENT_TOOLS.conversation).toContain('remove_leg');
    expect(SUB_AGENT_TOOLS.conversation).toContain('reorder_legs');
    expect(SUB_AGENT_TOOLS.conversation).toContain('plan_daily_schedule');
  });
});
