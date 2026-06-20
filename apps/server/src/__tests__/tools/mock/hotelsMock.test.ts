import { describe, expect, it } from 'vitest';

import type { HotelSearchInput } from 'app/tools/hotelsTool.js';
import { generateMockHotels } from 'app/tools/mock/hotelsMock.js';

describe('generateMockHotels', () => {
  const input: HotelSearchInput = {
    city: 'Barcelona',
    check_in: '2026-07-01',
    check_out: '2026-07-06',
    guests: 2,
  };

  it('returns a status:ok outcome with an array of HotelResult objects', () => {
    const outcome = generateMockHotels(input);
    expect(outcome.status).toBe('ok');
    expect(outcome.hotels).toBeInstanceOf(Array);
    expect(outcome.hotels.length).toBeGreaterThan(0);
  });

  it('each hotel has required HotelResult fields', () => {
    const outcome = generateMockHotels(input);
    for (const r of outcome.hotels) {
      expect(r).toHaveProperty('hotel_id');
      expect(r).toHaveProperty('offer_id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('city', 'Barcelona');
      expect(r).toHaveProperty('star_rating');
      expect(r).toHaveProperty('price_per_night');
      expect(r).toHaveProperty('total_price');
      expect(r).toHaveProperty('currency', 'USD');
      expect(r).toHaveProperty('check_in', '2026-07-01');
      expect(r).toHaveProperty('check_out', '2026-07-06');
    }
  });

  it('includes a range of star ratings', () => {
    const outcome = generateMockHotels(input);
    const ratings = outcome.hotels.map((r) => r.star_rating);
    expect(Math.min(...ratings)).toBeLessThanOrEqual(2);
    expect(Math.max(...ratings)).toBeGreaterThanOrEqual(4);
  });
});
