import { describe, expect, it } from 'vitest';

import { createTripSchema, updateTripSchema } from 'app/schemas/trips.js';

describe('createTripSchema', () => {
  it('accepts minimal valid input', () => {
    const result = createTripSchema.parse({ destination: 'Paris' });
    expect(result.destination).toBe('Paris');
    expect(result.budget_currency).toBe('USD');
    expect(result.travelers).toBe(1);
    expect(result.preferences).toEqual({});
  });

  it('rejects empty destination', () => {
    expect(() => createTripSchema.parse({ destination: '' })).toThrow();
  });

  it('rejects missing destination', () => {
    expect(() => createTripSchema.parse({})).toThrow();
  });

  it('rejects non-positive budget', () => {
    expect(() =>
      createTripSchema.parse({ destination: 'Paris', budget_total: 0 }),
    ).toThrow();
    expect(() =>
      createTripSchema.parse({ destination: 'Paris', budget_total: -100 }),
    ).toThrow();
  });

  it('rejects non-integer travelers', () => {
    expect(() =>
      createTripSchema.parse({ destination: 'Paris', travelers: 1.5 }),
    ).toThrow();
  });

  it('rejects non-positive travelers', () => {
    expect(() =>
      createTripSchema.parse({ destination: 'Paris', travelers: 0 }),
    ).toThrow();
  });

  it('validates preferences.style enum', () => {
    const result = createTripSchema.parse({
      destination: 'Paris',
      preferences: { style: 'luxury' },
    });
    expect(result.preferences.style).toBe('luxury');

    expect(() =>
      createTripSchema.parse({
        destination: 'Paris',
        preferences: { style: 'ultra-luxury' },
      }),
    ).toThrow();
  });

  it('validates preferences.pace enum', () => {
    const result = createTripSchema.parse({
      destination: 'Paris',
      preferences: { pace: 'relaxed' },
    });
    expect(result.preferences.pace).toBe('relaxed');

    expect(() =>
      createTripSchema.parse({
        destination: 'Paris',
        preferences: { pace: 'frantic' },
      }),
    ).toThrow();
  });

  it('accepts full valid input', () => {
    const result = createTripSchema.parse({
      destination: 'Tokyo',
      origin: 'SFO',
      departure_date: '2026-08-01',
      return_date: '2026-08-10',
      budget_total: 5000,
      budget_currency: 'EUR',
      travelers: 3,
      preferences: {
        style: 'mid-range',
        pace: 'moderate',
        interests: ['food', 'culture'],
      },
    });
    expect(result.destination).toBe('Tokyo');
    expect(result.travelers).toBe(3);
    expect(result.preferences.interests).toEqual(['food', 'culture']);
  });
});

describe('updateTripSchema', () => {
  it('accepts a partial update with only destination', () => {
    const result = updateTripSchema.safeParse({ destination: 'Tokyo' });
    expect(result.success).toBe(true);
  });

  it('accepts a partial update with only status', () => {
    const result = updateTripSchema.safeParse({ status: 'saved' });
    expect(result.success).toBe(true);
  });

  it('accepts all fields together', () => {
    const result = updateTripSchema.safeParse({
      destination: 'Paris',
      origin: 'JFK',
      departure_date: '2026-08-01',
      return_date: '2026-08-10',
      budget_total: 5000,
      travelers: 2,
      transport_mode: 'flying',
      trip_type: 'round_trip',
      status: 'saved',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status enum', () => {
    const result = updateTripSchema.safeParse({ status: 'deleted' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid transport_mode enum', () => {
    const result = updateTripSchema.safeParse({
      transport_mode: 'teleporting',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid trip_type enum', () => {
    const result = updateTripSchema.safeParse({ trip_type: 'multi_city' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive budget_total', () => {
    const result = updateTripSchema.safeParse({ budget_total: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer travelers', () => {
    const result = updateTripSchema.safeParse({ travelers: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects empty object (at least one field required)', () => {
    const result = updateTripSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('strips unknown fields', () => {
    const result = updateTripSchema.safeParse({
      destination: 'Rome',
      malicious_field: 'drop table',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('malicious_field' in result.data).toBe(false);
    }
  });

  it('accepts flexible_dates boolean', () => {
    expect(() =>
      updateTripSchema.parse({ flexible_dates: true }),
    ).not.toThrow();
    expect(() =>
      updateTripSchema.parse({ flexible_dates: false }),
    ).not.toThrow();
  });

  it('rejects non-boolean flexible_dates', () => {
    expect(() => updateTripSchema.parse({ flexible_dates: 'yes' })).toThrow();
  });
});
