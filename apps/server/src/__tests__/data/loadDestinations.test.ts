import { describe, expect, it } from 'vitest';

import { loadDestinations } from 'app/data/loadDestinations.js';

describe('loadDestinations', () => {
  it('loads the curated catalog as a non-empty array', () => {
    const destinations = loadDestinations();
    expect(destinations.length).toBeGreaterThan(20);
  });

  it('exposes the fields discovery ranks on', () => {
    const tokyo = loadDestinations().find((d) => d.slug === 'tokyo');
    expect(tokyo).toBeDefined();
    expect(tokyo?.country).toBe('Japan');
    expect(Array.isArray(tokyo?.categories)).toBe(true);
    expect(typeof tokyo?.price_level).toBe('number');
    expect(typeof tokyo?.estimated_daily_budget.budget).toBe('number');
    expect(tokyo?.weather.length).toBeGreaterThan(0);
  });

  it('returns the same cached array on repeat calls', () => {
    expect(loadDestinations()).toBe(loadDestinations());
  });
});
