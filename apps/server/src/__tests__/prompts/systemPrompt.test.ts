import { describe, expect, it } from 'vitest';

import { DEFAULT_COMPLETION_TRACKER } from 'app/prompts/bookingSteps.js';
import { buildSystemPrompt } from 'app/prompts/systemPrompt.js';
import type { TripContext } from 'app/prompts/tripContext.js';

describe('buildSystemPrompt', () => {
  it('should include core prompt in every response', () => {
    const result = buildSystemPrompt();
    expect(result).toContain('Voyager');
    expect(result).toContain('Rules');
    expect(result).toContain('format_response');
  });

  it('should include COLLECT_DETAILS addendum when no flow position', () => {
    const result = buildSystemPrompt();
    expect(result).toContain('Collecting Details');
  });

  it('should include COLLECT_DETAILS addendum for that phase', () => {
    const result = buildSystemPrompt(undefined, { phase: 'COLLECT_DETAILS' });
    expect(result).toContain('Collecting Details');
  });

  it('should include COMPLETE addendum for that phase', () => {
    const result = buildSystemPrompt(undefined, { phase: 'COMPLETE' });
    expect(result).toContain('Trip Booked');
  });

  it('should not include phase addendum for PLANNING', () => {
    const result = buildSystemPrompt(undefined, { phase: 'PLANNING' });
    expect(result).not.toContain('Collecting Details');
    expect(result).not.toContain('Trip Booked');
  });

  it('should include critical advisory when flag is set', () => {
    const result = buildSystemPrompt(undefined, undefined, {
      hasCriticalAdvisory: true,
    });
    expect(result).toContain('CRITICAL TRAVEL ADVISORY');
  });

  it('should not include critical advisory by default', () => {
    const result = buildSystemPrompt();
    expect(result).not.toContain('CRITICAL TRAVEL ADVISORY');
  });

  it('should include nudge when provided', () => {
    const result = buildSystemPrompt(
      undefined,
      { phase: 'PLANNING' },
      {
        nudge: "Note: you haven't discussed hotels yet.",
      },
    );
    expect(result).toContain('Planning Reminder');
    expect(result).toContain('hotels');
  });

  it('should include checklist during PLANNING phase with tracker', () => {
    const tripContext: TripContext = {
      destination: 'Paris',
      origin: 'JFK',
      departure_date: '2026-06-01',
      return_date: '2026-06-10',
      budget_total: 5000,
      budget_currency: 'USD',
      travelers: 2,
      transport_mode: 'flying',
      trip_type: null,
      flexible_dates: false,
      preferences: {},
      selected_flights: [],
      selected_hotels: [],
      selected_car_rentals: [],
      selected_experiences: [],
      total_spent: 0,
    };
    const result = buildSystemPrompt(
      tripContext,
      { phase: 'PLANNING' },
      {},
      DEFAULT_COMPLETION_TRACKER,
    );
    expect(result).toContain('Trip Planning Checklist');
    expect(result).toContain('Not yet discussed');
  });

  it('should include current date', () => {
    const result = buildSystemPrompt();
    const today = new Date().toISOString().split('T')[0];
    expect(result).toContain(today);
  });

  it('should include key tool references in core prompt', () => {
    const result = buildSystemPrompt();
    expect(result).toContain('format_response');
    expect(result).toContain('skip_category');
    expect(result).toContain('calculate_remaining_budget');
  });
});

const BASE_CTX: TripContext = {
  destination: 'Tokyo',
  origin: null,
  departure_date: '2026-08-01',
  return_date: '2026-08-10',
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
};

describe('buildSystemPrompt personality', () => {
  it('includes a travel advisor persona framing', () => {
    const prompt = buildSystemPrompt(
      BASE_CTX,
      { phase: 'COLLECT_DETAILS' },
      {},
      undefined,
    );
    expect(prompt.toLowerCase()).toMatch(/travel (advisor|concierge|planner)/);
  });

  it('does not use prohibited filler phrases', () => {
    const prompt = buildSystemPrompt(
      BASE_CTX,
      { phase: 'COLLECT_DETAILS' },
      {},
      undefined,
    );
    const forbidden = [
      'certainly!',
      'absolutely!',
      'great question',
      'of course!',
    ];
    forbidden.forEach((phrase) => {
      expect(prompt.toLowerCase()).not.toContain(phrase.toLowerCase());
    });
  });

  it('includes budget awareness language', () => {
    const prompt = buildSystemPrompt(
      BASE_CTX,
      { phase: 'PLANNING' },
      {},
      undefined,
    );
    expect(prompt.toLowerCase()).toContain('budget');
  });
});

describe('fabrication guardrails', () => {
  it('bans unbacked price estimates, not just fabricated options (H1)', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Never fabricate options');
    expect(prompt).toContain(
      'Never state prices, price ranges, or ballpark figures',
    );
    expect(prompt).toContain('do not estimate');
  });
});

describe('presentation order block', () => {
  it('emits journey segments in order with legacy dependency gates', () => {
    const prompt = buildSystemPrompt(
      undefined,
      undefined,
      undefined,
      DEFAULT_COMPLETION_TRACKER,
    );
    const flightIdx = prompt.indexOf('1. Flight');
    const hotelIdx = prompt.indexOf('2. Hotel');
    const experienceIdx = prompt.indexOf('3. Experiences');
    const carIdx = prompt.indexOf('4. Car rental');
    expect(flightIdx).toBeGreaterThan(-1);
    expect(hotelIdx).toBeGreaterThan(flightIdx);
    expect(experienceIdx).toBeGreaterThan(hotelIdx);
    expect(carIdx).toBeGreaterThan(experienceIdx);
    expect(prompt).toContain('one segment at a time');
    expect(prompt).toContain('at most one selectable tile set');
    // Legacy gate parity (critic finding 1): hotel gated on flight; experiences
    // gated on HOTEL in the prose even though routing unblocks after flight.
    expect(prompt).toMatch(
      /2\. Hotel:.*Only after the user has selected a flight/,
    );
    expect(prompt).toMatch(
      /3\. Experiences:.*Only after the user has selected a hotel/,
    );
    expect(prompt).toContain('call the appropriate select_* tool immediately');
    // Car rental is the only default-disabled slot; legacy 'Ask if needed'.
    expect(prompt).toMatch(/4\. Car rental: Ask if needed/);
  });

  it('emits the block even without a tracker (defaults to flight_trip)', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('one segment at a time');
    expect(prompt).toContain('1. Flight');
  });
});
