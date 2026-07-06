import { beforeEach, describe, expect, it, vi } from 'vitest';

import { query } from 'app/database/pool.js';
import {
  buildSelectionKey,
  getActualCostsForTrip,
  insertTripFlight,
  updateTrip,
} from 'app/repositories/trips/trips.js';

vi.mock('app/database/pool.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  withTransaction: vi.fn(),
}));

const mockQuery = vi.mocked(query);

// Per R-200 anti-pattern #5, the bulk of the old trips.test.ts file
// was tautological pool-mock assertions (mockResolvedValueOnce(row);
// expect(result).toEqual(row)) duplicating coverage that
// trips.integration.test.ts already provides against a real DB. The
// few tests kept here exercise behavior the integration test cannot
// efficiently isolate:
//   - getActualCostsForTrip parses Postgres ARRAY_AGG output and
//     coerces null/string totals to numbers; the parsing logic lives
//     in JS, not SQL, so a unit test is appropriate.
//   - insertTripFlight coerces a string price to a JS number before
//     binding; this prevents the "Claude returned price as string"
//     bug where silent insertion failure left the budget panel
//     stuck at zero.
//   - updateTrip enforces a column allowlist to prevent SQL/data
//     injection through attacker-controlled keys (id, user_id,
//     created_at). Asserting the SET clause shape is the security
//     guard that an integration test would have to reverse-engineer.

describe('getActualCostsForTrip', () => {
  const tripId = 'trip-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries the trip budget plus all 4 selection tables in one query', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          budget_total: '3000.00',
          flight_cost: '900.00',
          hotel_total_cost: '1200.00',
          car_rental_cost: '350.00',
          experience_costs: ['50.00', '75.00'],
        },
      ],
      rowCount: 1,
    } as never);

    const result = await getActualCostsForTrip(tripId);

    expect(mockQuery).toHaveBeenCalledOnce();
    const sql = mockQuery.mock.calls[0]![0] as string;
    expect(sql).toContain('trip_flights');
    expect(sql).toContain('trip_hotels');
    expect(sql).toContain('trip_car_rentals');
    expect(sql).toContain('trip_experiences');
    expect(sql).toContain('selected = true');

    expect(result).toEqual({
      total_budget: 3000,
      flight_cost: 900,
      hotel_total_cost: 1200,
      car_rental_cost: 350,
      experience_costs: [50, 75],
    });
  });

  it('returns zeros when no selections exist', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          budget_total: '2000.00',
          flight_cost: '0',
          hotel_total_cost: '0',
          car_rental_cost: '0',
          experience_costs: '{}',
        },
      ],
      rowCount: 1,
    } as never);

    const result = await getActualCostsForTrip(tripId);

    expect(result.flight_cost).toBe(0);
    expect(result.hotel_total_cost).toBe(0);
    expect(result.experience_costs).toEqual([]);
  });

  it('returns zero budget when trip has no budget set', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          budget_total: null,
          flight_cost: '500.00',
          hotel_total_cost: '0',
          car_rental_cost: '0',
          experience_costs: '{}',
        },
      ],
      rowCount: 1,
    } as never);

    const result = await getActualCostsForTrip(tripId);

    expect(result.total_budget).toBe(0);
    expect(result.flight_cost).toBe(500);
  });

  it('parses Postgres ARRAY_AGG string format for experience_costs', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          budget_total: '1000.00',
          flight_cost: '0',
          hotel_total_cost: '0',
          car_rental_cost: '0',
          experience_costs: '{50,75,100}',
        },
      ],
      rowCount: 1,
    } as never);

    const result = await getActualCostsForTrip(tripId);

    expect(result.experience_costs).toEqual([50, 75, 100]);
  });
});

describe('insertTripFlight string-price coercion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);
  });

  it('coerces a string price to a JS number before binding', async () => {
    // Claude tool-use responses can return numeric fields as strings.
    // z.number() rejects strings, the selection would fail silently,
    // and the budget sidebar would show no change. The repository
    // must coerce price to a JS number so the INSERT always uses a
    // numeric value.
    await insertTripFlight('trip-456', {
      airline: 'Iberia',
      flight_number: 'IB3156',
      origin: 'JFK',
      destination: 'MAD',
      price: '293' as unknown as number,
      currency: 'USD',
    });
    const values = mockQuery.mock.calls[0]![1] as unknown[];
    const priceIndex = values.indexOf(293);
    expect(priceIndex).toBeGreaterThan(-1);
    expect(typeof values[priceIndex]).toBe('number');
  });

  it('upserts via ON CONFLICT on the canonical route+departure dedupe key', async () => {
    await insertTripFlight('trip-789', {
      airline: 'Iberia',
      flight_number: 'IB3156',
      origin: 'JFK',
      destination: 'MAD',
      departure_time: '2026-07-01T10:00:00Z',
      booking_url: 'https://book/xyz',
    });
    const sql = mockQuery.mock.calls[0]![0] as string;
    const values = mockQuery.mock.calls[0]![1] as unknown[];
    expect(sql).toContain('ON CONFLICT (trip_id, selection_key) DO UPDATE');
    // selection_key derives from route + departure instant, never booking_url.
    expect(values[values.length - 1]).toBe('jfk|mad|2026-07-01T10:00');
  });
});

describe('buildSelectionKey', () => {
  it('joins canonicalized key columns and ignores booking_url', () => {
    expect(
      buildSelectionKey(
        { booking_url: 'https://book/abc', name: 'Louvre Tour' },
        ['name'],
      ),
    ).toBe('louvre tour');
  });

  it('joins key columns lowercased and trimmed', () => {
    expect(
      buildSelectionKey({ airline: ' Iberia ', flight_number: 'IB3156' }, [
        'airline',
        'flight_number',
      ]),
    ).toBe('iberia|ib3156');
  });

  it('renders missing key columns as empty segments', () => {
    expect(buildSelectionKey({ name: 'Louvre' }, ['name', 'category'])).toBe(
      'louvre|',
    );
  });
});

describe('flight selection dedupe key (2026-07-06 duplicate-flight incident)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);
  });

  // Captured from production tool_call_log, conversation d0c7419a: the
  // tile-click POST and the agent's select_flight persisted the SAME
  // flight with paraphrased airline/flight_number strings and different
  // timestamp formats, producing two selection_keys and a double-counted
  // budget. The key must derive only from fields both writers state
  // identically (route + departure instant), canonicalized.
  const tileClickPayload = {
    airline: 'American',
    flight_number: 'AA 2614',
    origin: 'SFO',
    destination: 'AUH',
    departure_time: '2026-07-08 06:04',
    price: 1186,
    currency: 'USD',
  };
  const agentSelectPayload = {
    airline: 'American and Etihad',
    flight_number: 'AA 2614 - EY 12',
    origin: 'SFO',
    destination: 'AUH',
    departure_time: '2026-07-08T06:04:00',
    price: 1186,
    currency: 'USD',
  };

  it('binds the same selection_key for the tile-click and agent payloads', async () => {
    await insertTripFlight('trip-1', tileClickPayload);
    await insertTripFlight('trip-1', agentSelectPayload);
    const firstValues = mockQuery.mock.calls[0]![1] as unknown[];
    const secondValues = mockQuery.mock.calls[1]![1] as unknown[];
    expect(firstValues[firstValues.length - 1]).toBe(
      secondValues[secondValues.length - 1],
    );
  });

  it('a booking_url present on only one writer does not split the key', async () => {
    await insertTripFlight('trip-1', {
      ...tileClickPayload,
      booking_url: 'https://serpapi/booking/abc123',
    });
    await insertTripFlight('trip-1', agentSelectPayload);
    const firstValues = mockQuery.mock.calls[0]![1] as unknown[];
    const secondValues = mockQuery.mock.calls[1]![1] as unknown[];
    expect(firstValues[firstValues.length - 1]).toBe(
      secondValues[secondValues.length - 1],
    );
  });

  it('canonicalizes timestamp format and letter case in key segments', () => {
    expect(
      buildSelectionKey({ departure_time: '2026-07-08 06:04', origin: 'SFO' }, [
        'origin',
        'departure_time',
      ]),
    ).toBe(
      buildSelectionKey(
        { departure_time: '2026-07-08T06:04:00', origin: 'sfo' },
        ['origin', 'departure_time'],
      ),
    );
  });
});

describe('updateTrip column allowlist (security)', () => {
  const tripId = 'trip-789';
  const userId = 'user-abc';

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({
      rows: [{ id: tripId, user_id: userId, destination: 'Paris' }],
      rowCount: 1,
    } as never);
  });

  it('rejects keys not in the UpdateTripInput allowlist', async () => {
    await updateTrip(tripId, userId, {
      destination: 'Paris',
      user_id: 'attacker',
    } as never);

    expect(mockQuery).toHaveBeenCalledOnce();
    const sql = mockQuery.mock.calls[0]![0] as string;
    const setClause = sql.slice(sql.indexOf('SET'), sql.indexOf('WHERE'));
    expect(setClause).not.toContain('user_id');
    expect(setClause).toContain('destination');
  });

  it('includes only allowed columns in SET clause and strips id/created_at', async () => {
    await updateTrip(tripId, userId, {
      destination: 'Tokyo',
      status: 'saved',
      id: 'injected-id',
      created_at: '2020-01-01',
    } as never);

    expect(mockQuery).toHaveBeenCalledOnce();
    const sql = mockQuery.mock.calls[0]![0] as string;
    const setClause = sql.slice(sql.indexOf('SET'), sql.indexOf('WHERE'));
    expect(setClause).toContain('destination');
    expect(setClause).toContain('status');
    expect(setClause).not.toContain('id =');
    expect(setClause).not.toContain('created_at');
    const values = mockQuery.mock.calls[0]![1] as unknown[];
    expect(values).toHaveLength(4); // 2 SET values + tripId + userId
  });

  it('returns null without issuing a query when all keys are disallowed', async () => {
    const result = await updateTrip(tripId, userId, {
      id: 'injected',
      created_at: '2020-01-01',
    } as never);

    expect(result).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('accepts all 9 valid UpdateTripInput fields', async () => {
    await updateTrip(tripId, userId, {
      destination: 'Berlin',
      origin: 'NYC',
      departure_date: '2026-07-01',
      return_date: '2026-07-10',
      budget_total: 3000,
      travelers: 2,
      transport_mode: 'flying',
      trip_type: 'round_trip',
      status: 'planning',
    });

    expect(mockQuery).toHaveBeenCalledOnce();
    const sql = mockQuery.mock.calls[0]![0] as string;
    expect(sql).toContain('destination');
    expect(sql).toContain('origin');
    expect(sql).toContain('departure_date');
    expect(sql).toContain('return_date');
    expect(sql).toContain('budget_total');
    expect(sql).toContain('travelers');
    expect(sql).toContain('transport_mode');
    expect(sql).toContain('trip_type');
    expect(sql).toContain('status');
  });
});
