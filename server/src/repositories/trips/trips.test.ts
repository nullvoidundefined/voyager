import type { PoolClient } from 'app/db/pool/pool.js';
import { query, withTransaction } from 'app/db/pool/pool.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearSelectionsForTrip } from './trips.js';

vi.mock('app/db/pool/pool.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  withTransaction: vi.fn(),
}));

const mockQuery = vi.mocked(query);
const mockWithTransaction = vi.mocked(withTransaction);

describe('clearSelectionsForTrip', () => {
  const tripId = 'trip-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithTransaction.mockImplementation(async (fn) => {
      const fakeClient = { query: vi.fn() } as unknown as PoolClient;
      return fn(fakeClient);
    });
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);
  });

  it('should use withTransaction for atomicity', async () => {
    await clearSelectionsForTrip(tripId);

    expect(mockWithTransaction).toHaveBeenCalledOnce();
    expect(mockWithTransaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should pass the transaction client to all 4 DELETE queries', async () => {
    const fakeClient = { query: vi.fn() } as unknown as PoolClient;
    mockWithTransaction.mockImplementation(async (fn) => fn(fakeClient));

    await clearSelectionsForTrip(tripId);

    expect(mockQuery).toHaveBeenCalledTimes(4);
    for (const call of mockQuery.mock.calls) {
      expect(call[2]).toBeDefined();
      expect(call[2]).toBe(fakeClient);
    }
  });

  it('should DELETE from all 4 selection tables', async () => {
    await clearSelectionsForTrip(tripId);

    const queries = mockQuery.mock.calls.map((c) => c[0]);
    expect(queries).toContain('DELETE FROM trip_flights WHERE trip_id = $1');
    expect(queries).toContain('DELETE FROM trip_hotels WHERE trip_id = $1');
    expect(queries).toContain(
      'DELETE FROM trip_car_rentals WHERE trip_id = $1',
    );
    expect(queries).toContain(
      'DELETE FROM trip_experiences WHERE trip_id = $1',
    );
  });

  it('should pass tripId as parameter to each DELETE', async () => {
    await clearSelectionsForTrip(tripId);

    for (const call of mockQuery.mock.calls) {
      expect(call[1]).toEqual([tripId]);
    }
  });
});
