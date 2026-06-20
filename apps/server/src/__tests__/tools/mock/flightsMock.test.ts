import { describe, expect, it } from 'vitest';

import type { FlightSearchInput } from 'app/tools/flightsTool.js';
import { generateMockFlights } from 'app/tools/mock/flightsMock.js';

describe('generateMockFlights', () => {
  const input: FlightSearchInput = {
    origin: 'SFO',
    destination: 'BCN',
    departure_date: '2026-07-01',
    passengers: 1,
    cabin_class: 'BUSINESS',
  };

  it('returns a status:ok outcome with an array of FlightResult objects', () => {
    const outcome = generateMockFlights(input);
    expect(outcome.status).toBe('ok');
    expect(outcome.flights).toBeInstanceOf(Array);
    expect(outcome.flights.length).toBeGreaterThan(0);
  });

  it('each flight has required FlightResult fields', () => {
    const outcome = generateMockFlights(input);
    for (const r of outcome.flights) {
      expect(r).toHaveProperty('offer_id');
      expect(r).toHaveProperty('origin', 'SFO');
      expect(r).toHaveProperty('destination', 'BCN');
      expect(r).toHaveProperty('departure_time');
      expect(r).toHaveProperty('arrival_time');
      expect(r).toHaveProperty('airline');
      expect(r).toHaveProperty('price');
      expect(r).toHaveProperty('currency', 'USD');
      expect(r).toHaveProperty('segments');
      expect(r.segments.length).toBeGreaterThan(0);
    }
  });

  it('uses input cabin_class when provided', () => {
    const outcome = generateMockFlights(input);
    for (const r of outcome.flights) {
      expect(r.cabin_class).toBe('BUSINESS');
    }
  });

  it('defaults cabin_class to ECONOMY when not provided', () => {
    const outcome = generateMockFlights({
      origin: 'SFO',
      destination: 'BCN',
      departure_date: '2026-07-01',
      passengers: 1,
    });
    for (const r of outcome.flights) {
      expect(r.cabin_class).toBe('ECONOMY');
    }
  });
});
