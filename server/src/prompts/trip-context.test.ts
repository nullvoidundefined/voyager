import { describe, expect, it } from 'vitest';

import type { CompletionTracker } from './booking-steps.js';
import {
  type TripContext,
  formatChecklist,
  formatTripContext,
} from './trip-context.js';

/**
 * Unit tests for the trip-context formatter. ENG-18 flagged this
 * file at 10% branch coverage despite being the sole driver of the
 * system prompt body. These tests exercise every conditional
 * branch in both exported functions so a change to the prompt
 * shape is caught at unit-test time, not at evaluation time.
 *
 * The functions are pure: input TripContext (and CompletionTracker
 * for the checklist), output Markdown string. Assertions use
 * substring / regex matches rather than snapshot matches so the
 * tests are readable and a deliberate prompt change only touches
 * the specific assertion that changed.
 */

function baseContext(overrides: Partial<TripContext> = {}): TripContext {
  return {
    destination: 'San Francisco',
    origin: null,
    departure_date: null,
    return_date: null,
    budget_total: 0,
    budget_currency: 'USD',
    travelers: 1,
    transport_mode: null,
    preferences: {},
    selected_flights: [],
    selected_hotels: [],
    selected_car_rentals: [],
    selected_experiences: [],
    total_spent: 0,
    ...overrides,
  };
}

describe('formatTripContext', () => {
  it('always includes the destination and travelers', () => {
    const out = formatTripContext(baseContext());
    expect(out).toContain('## Current Trip Plan');
    expect(out).toContain('**Destination:** San Francisco');
    expect(out).toContain('**Travelers:** 1');
  });

  it('omits origin when null', () => {
    const out = formatTripContext(baseContext({ origin: null }));
    expect(out).not.toContain('**Origin:**');
  });

  it('includes origin when set', () => {
    const out = formatTripContext(baseContext({ origin: 'Denver' }));
    expect(out).toContain('**Origin:** Denver');
  });

  it('omits dates when null', () => {
    const out = formatTripContext(baseContext());
    expect(out).not.toContain('**Departure:**');
    expect(out).not.toContain('**Return:**');
  });

  it('includes dates when set', () => {
    const out = formatTripContext(
      baseContext({
        departure_date: '2026-06-01',
        return_date: '2026-06-04',
      }),
    );
    expect(out).toContain('**Departure:** 2026-06-01');
    expect(out).toContain('**Return:** 2026-06-04');
  });

  it('omits budget when zero or less', () => {
    const out = formatTripContext(baseContext({ budget_total: 0 }));
    expect(out).not.toContain('**Budget:**');
    expect(out).not.toContain('### Budget Status');
  });

  it('includes budget and budget status when positive', () => {
    const out = formatTripContext(
      baseContext({ budget_total: 2500, total_spent: 400 }),
    );
    expect(out).toContain('**Budget:** USD 2500');
    expect(out).toContain('### Budget Status');
    expect(out).toContain('Spent: $400 / $2500');
    expect(out).toContain('Remaining: $2100');
  });

  it('includes transport_mode when set', () => {
    const out = formatTripContext(baseContext({ transport_mode: 'flying' }));
    expect(out).toContain('**Transport:** flying');
  });

  describe('preferences section', () => {
    it('is omitted when all preferences are empty', () => {
      const out = formatTripContext(baseContext());
      expect(out).not.toContain('### Preferences');
    });

    it('includes style when set', () => {
      const out = formatTripContext(
        baseContext({ preferences: { style: 'luxury' } }),
      );
      expect(out).toContain('### Preferences');
      expect(out).toContain('Style: luxury');
    });

    it('includes pace when set', () => {
      const out = formatTripContext(
        baseContext({ preferences: { pace: 'relaxed' } }),
      );
      expect(out).toContain('Pace: relaxed');
    });

    it('includes interests when set', () => {
      const out = formatTripContext(
        baseContext({ preferences: { interests: ['food', 'hiking'] } }),
      );
      expect(out).toContain('Interests: food, hiking');
    });
  });

  describe('user_preferences section', () => {
    it('is omitted when user_preferences is undefined', () => {
      const out = formatTripContext(baseContext());
      expect(out).not.toContain('### User Preferences');
    });

    it('includes accommodation, pace, dining, travel_party, budget_comfort', () => {
      const out = formatTripContext(
        baseContext({
          user_preferences: {
            accommodation: 'hotel',
            travel_pace: 'medium',
            dietary: ['vegetarian'],
            dining_style: 'local',
            activities: ['museums', 'hiking'],
            travel_party: 'couple',
            budget_comfort: 'comfortable',
          },
        }),
      );
      expect(out).toContain('### User Preferences');
      expect(out).toContain('- Accommodation: hotel');
      expect(out).toContain('- Travel pace: medium');
      expect(out).toContain('- Dietary: vegetarian');
      expect(out).toContain('- Dining style: local');
      expect(out).toContain('- Activities: museums, hiking');
      expect(out).toContain('- Travel party: couple');
      expect(out).toContain('- Budget comfort: comfortable');
    });

    it('suppresses dietary when the only entry is "none"', () => {
      const out = formatTripContext(
        baseContext({
          user_preferences: {
            accommodation: null,
            travel_pace: null,
            dietary: ['none'],
            dining_style: null,
            activities: [],
            travel_party: null,
            budget_comfort: null,
          },
        }),
      );
      expect(out).not.toContain('- Dietary:');
    });

    it('omits fields that are null or empty arrays', () => {
      const out = formatTripContext(
        baseContext({
          user_preferences: {
            accommodation: null,
            travel_pace: null,
            dietary: [],
            dining_style: null,
            activities: [],
            travel_party: null,
            budget_comfort: null,
          },
        }),
      );
      expect(out).toContain('### User Preferences');
      expect(out).not.toContain('- Accommodation:');
      expect(out).not.toContain('- Travel pace:');
      expect(out).not.toContain('- Dietary:');
    });
  });

  describe('safety context injections', () => {
    it('adds LGBTQ+ line when lgbtq_safety=true', () => {
      const out = formatTripContext(
        baseContext({
          user_preferences: {
            accommodation: null,
            travel_pace: null,
            dietary: [],
            dining_style: null,
            activities: [],
            travel_party: null,
            budget_comfort: null,
            lgbtq_safety: true,
          },
        }),
      );
      expect(out).toContain('### Safety Context');
      expect(out).toContain('LGBTQ+ travel safety');
    });

    it('adds woman/non-binary line when gender matches', () => {
      const out = formatTripContext(
        baseContext({
          user_preferences: {
            accommodation: null,
            travel_pace: null,
            dietary: [],
            dining_style: null,
            activities: [],
            travel_party: null,
            budget_comfort: null,
            gender: 'woman',
          },
        }),
      );
      expect(out).toContain('identifies as a woman');
    });

    it('adds non-binary line when gender is non_binary', () => {
      const out = formatTripContext(
        baseContext({
          user_preferences: {
            accommodation: null,
            travel_pace: null,
            dietary: [],
            dining_style: null,
            activities: [],
            travel_party: null,
            budget_comfort: null,
            gender: 'non_binary',
          },
        }),
      );
      expect(out).toContain('identifies as non-binary');
    });

    it('adds solo travel line when travel_party=solo', () => {
      const out = formatTripContext(
        baseContext({
          user_preferences: {
            accommodation: null,
            travel_pace: null,
            dietary: [],
            dining_style: null,
            activities: [],
            travel_party: 'solo',
            budget_comfort: null,
          },
        }),
      );
      expect(out).toContain('traveling solo');
    });

    it('omits Safety Context header when no safety flags are set', () => {
      const out = formatTripContext(
        baseContext({
          user_preferences: {
            accommodation: null,
            travel_pace: null,
            dietary: [],
            dining_style: null,
            activities: [],
            travel_party: 'couple',
            budget_comfort: null,
          },
        }),
      );
      expect(out).not.toContain('### Safety Context');
    });
  });

  describe('selections sections', () => {
    it('renders flights, hotels, car rentals, and experiences when present', () => {
      const out = formatTripContext(
        baseContext({
          selected_flights: [
            {
              airline: 'Delta',
              flight_number: 'DL100',
              price: 300,
              departure_time: '08:00',
              arrival_time: '10:00',
            },
          ],
          selected_hotels: [
            {
              name: 'Test Hotel',
              price_per_night: 200,
              total_price: 800,
              star_rating: 4,
            },
          ],
          selected_car_rentals: [
            {
              provider: 'Hertz',
              car_name: 'Camry',
              car_type: 'midsize',
              price_per_day: 60,
              total_price: 180,
            },
          ],
          selected_experiences: [
            {
              name: 'Bay Cruise',
              estimated_cost: 75,
              category: 'tour',
            },
          ],
        }),
      );
      expect(out).toContain('### Selected Flights');
      expect(out).toContain('Delta DL100: $300');
      expect(out).toContain('### Selected Hotels');
      expect(out).toContain('Test Hotel: $200/night ($800 total), 4★');
      expect(out).toContain('### Selected Car Rentals');
      expect(out).toContain('Camry from Hertz: $180');
      expect(out).toContain('### Selected Experiences');
      expect(out).toContain('Bay Cruise (tour): ~$75');
    });

    it('omits each selection section when empty', () => {
      const out = formatTripContext(baseContext());
      expect(out).not.toContain('### Selected Flights');
      expect(out).not.toContain('### Selected Hotels');
      expect(out).not.toContain('### Selected Car Rentals');
      expect(out).not.toContain('### Selected Experiences');
    });
  });
});

describe('formatChecklist', () => {
  function baseTracker(
    overrides: Partial<CompletionTracker> = {},
  ): CompletionTracker {
    return {
      version: 2,
      transport: 'pending',
      flights: 'pending',
      hotels: 'pending',
      car_rental: 'pending',
      experiences: 'pending',
      turns_since_last_progress: 0,
      ...overrides,
    };
  }

  it('emits the header and the reminder footer', () => {
    const out = formatChecklist(baseTracker(), baseContext());
    expect(out).toContain('## Trip Planning Checklist');
    expect(out).toContain('All categories must be addressed');
  });

  describe('transport line', () => {
    it('shows pending marker when transport is pending', () => {
      const out = formatChecklist(baseTracker(), baseContext());
      expect(out).toContain('⬜ Transportation: Not yet decided');
    });

    it('shows flying when transport is flying', () => {
      const out = formatChecklist(
        baseTracker({ transport: 'flying' }),
        baseContext(),
      );
      expect(out).toContain('✅ Transportation: Flying');
    });

    it('shows driving when transport is driving', () => {
      const out = formatChecklist(
        baseTracker({ transport: 'driving' }),
        baseContext(),
      );
      expect(out).toContain('✅ Transportation: Driving');
    });
  });

  describe('flights line', () => {
    it('shows the selected flight when flights=selected and flights array is non-empty', () => {
      const ctx = baseContext({
        selected_flights: [
          {
            airline: 'Delta',
            flight_number: 'DL100',
            price: 300,
            departure_time: '08:00',
            arrival_time: '10:00',
          },
        ],
      });
      const out = formatChecklist(baseTracker({ flights: 'selected' }), ctx);
      expect(out).toContain('✅ Flights: Delta DL100');
      expect(out).toContain('$300');
    });

    it('shows skipped marker when flights=skipped', () => {
      const out = formatChecklist(
        baseTracker({ flights: 'skipped' }),
        baseContext(),
      );
      expect(out).toContain('Flights: Skipped');
    });

    it('shows browsing when flights=searching', () => {
      const out = formatChecklist(
        baseTracker({ flights: 'searching' }),
        baseContext(),
      );
      expect(out).toContain('Flights: Browsing options');
    });
  });

  describe('hotels line', () => {
    it('shows the selected hotel when hotels=selected and hotels array is non-empty', () => {
      const ctx = baseContext({
        selected_hotels: [
          {
            name: 'Test Hotel',
            price_per_night: 200,
            total_price: 800,
            star_rating: 4,
          },
        ],
      });
      const out = formatChecklist(baseTracker({ hotels: 'selected' }), ctx);
      expect(out).toContain('✅ Hotels: Test Hotel');
      expect(out).toContain('$800 total');
    });
  });

  describe('car rental line', () => {
    it('shows the selected car when car_rental=selected', () => {
      const ctx = baseContext({
        selected_car_rentals: [
          {
            provider: 'Hertz',
            car_name: 'Camry',
            car_type: 'midsize',
            price_per_day: 60,
            total_price: 180,
          },
        ],
      });
      const out = formatChecklist(baseTracker({ car_rental: 'selected' }), ctx);
      expect(out).toContain('✅ Car Rental: Camry from Hertz');
    });
  });

  describe('experiences line', () => {
    it('shows count and total cost when experiences=selected', () => {
      const ctx = baseContext({
        selected_experiences: [
          { name: 'Bay Cruise', estimated_cost: 75, category: 'tour' },
          { name: 'Museum', estimated_cost: 25, category: 'culture' },
        ],
      });
      const out = formatChecklist(
        baseTracker({ experiences: 'selected' }),
        ctx,
      );
      expect(out).toContain('✅ Experiences: 2 selected');
      expect(out).toContain('$100 total');
    });
  });

  describe('budget line', () => {
    it('is omitted when budget_total is zero', () => {
      const out = formatChecklist(baseTracker(), baseContext());
      expect(out).not.toMatch(/Budget: \$[0-9]+ remaining/);
    });

    it('shows remaining budget when budget_total is positive', () => {
      const ctx = baseContext({ budget_total: 2500, total_spent: 400 });
      const out = formatChecklist(baseTracker(), ctx);
      expect(out).toContain('Budget: $2100 remaining of $2500');
    });
  });
});
