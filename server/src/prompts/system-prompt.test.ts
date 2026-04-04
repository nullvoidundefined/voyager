import { describe, expect, it } from 'vitest';

import { DEFAULT_COMPLETION_TRACKER } from './booking-steps.js';
import { buildSystemPrompt } from './system-prompt.js';

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
    const tripContext = {
      destination: 'Paris',
      origin: 'JFK',
      departure_date: '2026-06-01',
      return_date: '2026-06-10',
      budget_total: 5000,
      budget_currency: 'USD',
      travelers: 2,
      transport_mode: 'flying' as const,
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
