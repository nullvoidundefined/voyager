import { describe, expect, it } from 'vitest';

import { discoverDestinations } from 'app/tools/discoverDestinationsTool.js';

describe('discoverDestinations', () => {
  it('returns warm, budget destinations for a warm-and-cheap query', () => {
    const result = discoverDestinations({
      climate: 'warm',
      max_price_level: 2,
      month: 'February',
    });
    expect(result.status).toBe('ok');
    expect(result.destinations.length).toBeGreaterThan(0);
    for (const offer of result.destinations) {
      expect(Number(offer.detail?.price_level)).toBeLessThanOrEqual(2);
      expect(offer.price_unit).toBe('per_day');
    }
  });

  it('ranks vibe matches ahead of non-matches', () => {
    const result = discoverDestinations({ limit: 30, vibes: ['beach'] });
    const first = result.destinations[0]!;
    expect(String(first.badges?.join(' ')).toLowerCase()).toContain('beach');
  });

  it('honors the limit', () => {
    expect(discoverDestinations({ limit: 3 }).destinations).toHaveLength(3);
  });

  it('returns no_results when no destination satisfies the hard filters', () => {
    const result = discoverDestinations({ max_daily_budget_usd: 1 });
    expect(result.status).toBe('no_results');
    expect(result.destinations).toEqual([]);
  });

  it('does not invent a price: uses the curated per-day budget estimate', () => {
    const offer = discoverDestinations({ limit: 1 }).destinations[0]!;
    expect(offer.price).toBeGreaterThan(0);
    expect(offer.currency).toBe('USD');
  });
});
