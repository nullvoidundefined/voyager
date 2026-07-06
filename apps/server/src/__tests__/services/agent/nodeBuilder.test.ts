import { describe, expect, it } from 'vitest';

import { buildNodeFromToolResult } from 'app/services/agent/nodeBuilder.js';

describe('buildNodeFromToolResult', () => {
  it('maps search_flights result to a flight offer_tiles node', () => {
    // Tool results are arrays, not { flights: [...] }
    const result = [
      {
        airline: 'Delta',
        airline_logo: 'https://logo.com/delta.png',
        flight_number: 'DL123',
        origin: 'JFK',
        destination: 'NRT',
        departure_time: '2026-05-01T08:00:00',
        arrival_time: '2026-05-02T12:00:00',
        price: 850,
        currency: 'USD',
      },
    ];

    const node = buildNodeFromToolResult('search_flights', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('offer_tiles');
    if (node!.type === 'offer_tiles') {
      expect(node!.offer_kind).toBe('flight');
      expect(node!.offers).toHaveLength(1);
      expect(node!.offers[0]!.detail?.airline).toBe('Delta');
      expect(node!.offers[0]!.detail?.origin).toBe('JFK');
      expect(node!.offers[0]!.detail?.destination).toBe('NRT');
      expect(node!.offers[0]!.title).toBe('Delta DL123');
      expect(node!.selectable).toBe(true);
    }
  });

  it('maps search_hotels result to a hotel offer_tiles node', () => {
    const result = [
      {
        name: 'Tokyo Grand',
        city: 'Tokyo',
        star_rating: 4,
        price_per_night: 120,
        total_price: 840,
        currency: 'USD',
        check_in: '2026-05-01',
        check_out: '2026-05-08',
      },
    ];

    const node = buildNodeFromToolResult('search_hotels', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('offer_tiles');
    if (node!.type === 'offer_tiles') {
      expect(node!.offer_kind).toBe('hotel');
      expect(node!.offers).toHaveLength(1);
      expect(node!.offers[0]!.title).toBe('Tokyo Grand');
      expect(node!.selectable).toBe(true);
    }
  });

  it('maps search_car_rentals result to a car_rental offer_tiles node', () => {
    const result = [
      {
        provider: 'Hertz',
        car_name: 'Toyota Corolla',
        car_type: 'compact',
        price_per_day: 45,
        total_price: 315,
        currency: 'USD',
        pickup_location: 'NRT Airport',
        dropoff_location: 'NRT Airport',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
        features: ['Automatic', 'AC', '5 seats'],
      },
    ];

    const node = buildNodeFromToolResult('search_car_rentals', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('offer_tiles');
    if (node!.type === 'offer_tiles') {
      expect(node!.offer_kind).toBe('car_rental');
      expect(node!.offers).toHaveLength(1);
      expect(node!.offers[0]!.detail?.provider).toBe('Hertz');
      expect(node!.selectable).toBe(true);
    }
  });

  it('maps search_experiences result to an experience offer_tiles node', () => {
    const result = [
      {
        name: 'Senso-ji Temple',
        category: 'Temple',
        rating: 4.6,
        estimated_cost: 0,
      },
    ];

    const node = buildNodeFromToolResult('search_experiences', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('offer_tiles');
    if (node!.type === 'offer_tiles') {
      expect(node!.offer_kind).toBe('experience');
    }
  });

  it('maps calculate_remaining_budget to budget_bar node', () => {
    const result = {
      total_budget: 3000,
      total_spent: 1850,
      remaining: 1150,
      currency: 'USD',
    };

    const node = buildNodeFromToolResult('calculate_remaining_budget', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('budget_bar');
    if (node!.type === 'budget_bar') {
      expect(node!.allocated).toBe(1850);
      expect(node!.total).toBe(3000);
      expect(node!.currency).toBe('USD');
    }
  });

  it('returns null for tools without a node mapping (update_trip, get_destination_info)', () => {
    expect(buildNodeFromToolResult('update_trip', {})).toBeNull();
    expect(buildNodeFromToolResult('get_destination_info', {})).toBeNull();
    expect(buildNodeFromToolResult('format_response', {})).toBeNull();
  });

  it('returns null for structured search failures (F-17)', () => {
    expect(
      buildNodeFromToolResult('search_flights', { status: 'timeout' }),
    ).toBeNull();
    expect(
      buildNodeFromToolResult('search_hotels', { status: 'quota_exhausted' }),
    ).toBeNull();
  });

  describe('edge cases in normalization', () => {
    it('handles object-shape tool results with named keys', () => {
      const node = buildNodeFromToolResult('search_flights', {
        flights: [
          {
            airline: 'Delta',
            airline_logo: null,
            flight_number: 'DL1',
            origin: 'JFK',
            destination: 'LAX',
            departure_time: '2026-05-01T08:00:00',
            arrival_time: '2026-05-01T12:00:00',
            price: 300,
            currency: 'USD',
          },
        ],
      });
      expect(node).not.toBeNull();
      if (node!.type === 'offer_tiles') {
        expect(node!.offers).toHaveLength(1);
      }
    });

    it('returns an empty offers array when the result has neither array nor named key', () => {
      const node = buildNodeFromToolResult('search_flights', {
        unrelated: 'field',
      });
      expect(node).not.toBeNull();
      if (node!.type === 'offer_tiles') {
        expect(node!.offers).toEqual([]);
      }
    });

    it('defaults missing hotel price fields to zero', () => {
      const node = buildNodeFromToolResult('search_hotels', [
        { name: 'Cheap Hotel', currency: 'USD' },
      ]);
      if (node!.type === 'offer_tiles') {
        expect(node!.offers[0]?.detail?.price_per_night).toBe(0);
        expect(node!.offers[0]?.detail?.total_price).toBe(0);
        expect(node!.offers[0]?.price).toBe(0);
      }
    });

    it('supports lat/lon AND latitude/longitude shapes on hotels', () => {
      const node = buildNodeFromToolResult('search_hotels', [
        {
          name: 'A',
          currency: 'USD',
          price_per_night: 100,
          total_price: 500,
          latitude: 37.7,
          longitude: -122.4,
        },
        {
          name: 'B',
          currency: 'USD',
          price_per_night: 100,
          total_price: 500,
          lat: 48.8,
          lon: 2.3,
        },
      ]);
      if (node!.type === 'offer_tiles') {
        expect(node!.offers[0]?.lat).toBe(37.7);
        expect(node!.offers[0]?.lon).toBe(-122.4);
        expect(node!.offers[1]?.lat).toBe(48.8);
        expect(node!.offers[1]?.lon).toBe(2.3);
      }
    });

    it('defaults car rental features to empty badges when missing', () => {
      const node = buildNodeFromToolResult('search_car_rentals', [
        {
          provider: 'Avis',
          car_name: 'Civic',
          car_type: 'compact',
          price_per_day: 40,
          total_price: 200,
          currency: 'USD',
        },
      ]);
      if (node!.type === 'offer_tiles') {
        expect(node!.offers[0]?.badges).toEqual([]);
      }
    });

    it('uses zero defaults when calculate_remaining_budget has empty result', () => {
      const node = buildNodeFromToolResult('calculate_remaining_budget', {});
      expect(node).not.toBeNull();
      if (node!.type === 'budget_bar') {
        expect(node!.allocated).toBe(0);
        expect(node!.total).toBe(0);
        expect(node!.currency).toBe('USD');
      }
    });
  });
});

describe('indicative knowledge-base outcomes', () => {
  it('renders offer tiles for indicative ok outcomes (KB backstop)', () => {
    const node = buildNodeFromToolResult('search_flights', {
      status: 'ok',
      indicative: true,
      flights: [
        {
          airline: 'Delta',
          flight_number: 'DL123',
          origin: 'JFK',
          destination: 'NRT',
          departure_time: '2026-05-01T08:00:00',
          price: 850,
          currency: 'USD',
        },
      ],
    });
    expect(node?.type).toBe('offer_tiles');
    if (node?.type === 'offer_tiles') {
      expect(node.offers).toHaveLength(1);
    }
  });
});
