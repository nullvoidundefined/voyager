import { DEFAULT_COMPLETION_TRACKER } from 'app/prompts/bookingSteps/bookingSteps.js';
import type { TripContext } from 'app/prompts/tripContext/tripContext.js';
import type { TripPlanCard } from 'app/types/planCard.js';
import { describe, expect, it } from 'vitest';

import { buildConversationAgentPrompt } from '../conversationPrompt.js';
import { buildExperienceAgentPrompt } from '../experiencePrompt.js';
import { buildFlightAgentPrompt } from '../flightPrompt.js';
import { buildGroundAgentPrompt } from '../groundPrompt.js';
import { buildHotelAgentPrompt } from '../hotelPrompt.js';
import { buildPlanAgentPrompt } from '../planPrompt.js';

function baseContext(overrides: Partial<TripContext> = {}): TripContext {
  return {
    destination: 'Tokyo',
    origin: null,
    departure_date: null,
    return_date: null,
    budget_total: 3000,
    budget_currency: 'USD',
    travelers: 2,
    transport_mode: null,
    trip_type: null,
    flexible_dates: false,
    preferences: {},
    selected_flights: [],
    selected_hotels: [],
    selected_car_rentals: [],
    selected_experiences: [],
    total_spent: 0,
    ...overrides,
  };
}

const minimalCard: TripPlanCard = {
  categories: [
    {
      id: 'flights',
      label: 'Flights',
      enabled: true,
      not_applicable: false,
    },
  ],
};

describe('buildConversationAgentPrompt', () => {
  it('returns a non-empty string containing the agent role', () => {
    const result = buildConversationAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Conversation Agent');
  });

  it('includes booking status for each category', () => {
    const result = buildConversationAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toContain('flights');
    expect(result).toContain('hotels');
    expect(result).toContain('experiences');
  });
});

describe('buildFlightAgentPrompt', () => {
  it('returns a non-empty string containing the agent role', () => {
    const result = buildFlightAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(typeof result).toBe('string');
    expect(result).toContain('Flight Agent');
  });

  it('includes interests note when interests are set', () => {
    const tracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      experience_interests: ['dining', 'activities'],
    };
    const result = buildFlightAgentPrompt(baseContext(), tracker);
    expect(result).toContain('dining');
  });

  it('instructs the agent to honor explicit user flight choices (B13)', () => {
    const result = buildFlightAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toMatch(/names a specific flight/i);
    expect(result).toMatch(/do not.*alternatives/i);
  });
});

describe('buildHotelAgentPrompt', () => {
  it('returns a non-empty string containing the agent role', () => {
    const result = buildHotelAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toContain('Hotel Agent');
  });

  it('includes amenity hint when interests are set', () => {
    const tracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      experience_interests: ['wellness'],
    };
    const result = buildHotelAgentPrompt(baseContext(), tracker);
    expect(result).toContain('wellness');
  });

  it('instructs the agent to honor explicit user hotel choices (B13)', () => {
    const result = buildHotelAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toMatch(/names a specific hotel/i);
    expect(result).toMatch(/do not.*alternatives/i);
  });
});

describe('buildGroundAgentPrompt', () => {
  it('returns a non-empty string containing the agent role', () => {
    const result = buildGroundAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toContain('Ground Transportation Agent');
  });

  it('includes driving note when transport_mode is driving', () => {
    const result = buildGroundAgentPrompt(
      baseContext({ transport_mode: 'driving' }),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toContain('driving');
  });
});

describe('buildExperienceAgentPrompt', () => {
  it('returns a non-empty string containing the agent role', () => {
    const result = buildExperienceAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toContain('Experience Agent');
  });

  it('uses interest-based categories when interests are set', () => {
    const tracker = {
      ...DEFAULT_COMPLETION_TRACKER,
      experience_interests: ['dining', 'theater'],
    };
    const result = buildExperienceAgentPrompt(baseContext(), tracker);
    expect(result).toContain('dining');
    expect(result).toContain('restaurant');
  });

  it('uses default categories when no interests are set', () => {
    const result = buildExperienceAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toContain('sightseeing');
  });

  it('instructs the agent to honor explicit user experience choices (B13)', () => {
    const result = buildExperienceAgentPrompt(
      baseContext(),
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toMatch(/names a specific experience/i);
    expect(result).toMatch(/do not.*alternatives/i);
  });
});

describe('buildPlanAgentPrompt', () => {
  it('returns a non-empty string containing the agent role', () => {
    const result = buildPlanAgentPrompt(minimalCard);
    expect(result).toContain('PLAN_TRIP');
  });

  it('includes trip context when provided', () => {
    const result = buildPlanAgentPrompt(minimalCard, baseContext());
    expect(result).toContain('Trip State');
    expect(result).toContain('Tokyo');
  });

  it('omits trip context section when not provided', () => {
    const result = buildPlanAgentPrompt(minimalCard);
    expect(result).not.toContain('Trip State');
  });
});
