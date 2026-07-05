import { describe, expect, it } from 'vitest';

import { normalizeLegacyNode } from 'app/services/agent/normalizeLegacyNode.js';

describe('normalizeLegacyNode', () => {
  it('converts a persisted flight_tiles node to offer_tiles preserving ids', () => {
    const legacy = {
      type: 'flight_tiles',
      selectable: true,
      flights: [
        {
          id: 'f-persisted-1',
          airline: 'Delta',
          flight_number: 'DL123',
          origin: 'JFK',
          destination: 'NRT',
          departure_time: '2026-05-01T08:00:00',
          price: 850,
          currency: 'USD',
        },
      ],
    };
    const node = normalizeLegacyNode(legacy);
    expect(node.type).toBe('offer_tiles');
    if (node.type === 'offer_tiles') {
      expect(node.offer_kind).toBe('flight');
      expect(node.selectable).toBe(true);
      expect(node.offers[0]?.id).toBe('f-persisted-1');
      expect(node.offers[0]?.detail?.airline).toBe('Delta');
    }
  });

  it('converts hotel/car/experience tiles to their offer kinds', () => {
    const hotel = normalizeLegacyNode({
      type: 'hotel_tiles',
      selectable: false,
      hotels: [
        {
          id: 'h1',
          name: 'Tokyo Grand',
          city: 'Tokyo',
          star_rating: 4,
          price_per_night: 120,
          total_price: 840,
          currency: 'USD',
          check_in: '2026-05-01',
          check_out: '2026-05-08',
        },
      ],
    });
    expect(hotel.type).toBe('offer_tiles');
    if (hotel.type === 'offer_tiles') {
      expect(hotel.offer_kind).toBe('hotel');
      expect(hotel.selectable).toBe(false);
    }

    const car = normalizeLegacyNode({
      type: 'car_rental_tiles',
      selectable: true,
      rentals: [
        {
          id: 'c1',
          provider: 'Hertz',
          car_name: 'Corolla',
          car_type: 'compact',
          price_per_day: 45,
          total_price: 315,
          currency: 'USD',
          pickup_location: 'NRT',
          dropoff_location: 'NRT',
          pickup_date: '2026-05-01',
          dropoff_date: '2026-05-08',
          features: [],
        },
      ],
    });
    if (car.type === 'offer_tiles') {
      expect(car.offer_kind).toBe('car_rental');
    }

    const experience = normalizeLegacyNode({
      type: 'experience_tiles',
      selectable: true,
      experiences: [
        { id: 'e1', name: 'Temple', category: 'Culture', estimated_cost: 10 },
      ],
    });
    if (experience.type === 'offer_tiles') {
      expect(experience.offer_kind).toBe('experience');
      expect(experience.offers[0]?.id).toBe('e1');
    }
  });

  it('passes modern nodes through unchanged', () => {
    const text = { type: 'text' as const, content: 'hello' };
    expect(normalizeLegacyNode(text)).toBe(text);

    const offerTiles = {
      type: 'offer_tiles' as const,
      offer_kind: 'flight' as const,
      offers: [],
      selectable: true,
    };
    expect(normalizeLegacyNode(offerTiles)).toBe(offerTiles);
  });
});
