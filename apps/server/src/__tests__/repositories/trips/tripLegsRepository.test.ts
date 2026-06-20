import { beforeEach, describe, expect, it, vi } from 'vitest';

import { query } from 'app/database/pool.js';
import {
  createLeg,
  deleteLeg,
  listLegs,
  reorderLegs,
} from 'app/repositories/trips/tripLegsRepository.js';

vi.mock('app/database/pool.js', () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createLeg', () => {
  it('INSERTs trip_legs with all 5 columns and returns the row', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'leg-1' }],
      rowCount: 1,
    } as never);

    const result = await createLeg('trip-1', {
      origin: 'JFK',
      destination: 'CDG',
      depart_date: '2026-09-01',
      leg_order: 1,
    });

    expect(mockQuery).toHaveBeenCalledOnce();
    const sql = mockQuery.mock.calls[0]![0] as string;
    const params = mockQuery.mock.calls[0]![1] as unknown[];
    expect(sql).toContain('INSERT INTO trip_legs');
    expect(sql).toContain('RETURNING *');
    expect(params).toEqual(['trip-1', 'JFK', 'CDG', '2026-09-01', 1]);
    expect(result.id).toBe('leg-1');
  });
});

describe('listLegs', () => {
  it('SELECTs legs for a trip ordered by leg_order ASC', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'leg-1' }, { id: 'leg-2' }],
      rowCount: 2,
    } as never);

    const result = await listLegs('trip-1');

    const sql = mockQuery.mock.calls[0]![0] as string;
    expect(sql).toMatch(/ORDER BY leg_order ASC/);
    expect(result).toHaveLength(2);
  });
});

describe('deleteLeg', () => {
  it('scopes the DELETE to both id and trip_id (SEC-01)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await deleteLeg('leg-1', 'trip-1');

    const sql = mockQuery.mock.calls[0]![0] as string;
    const params = mockQuery.mock.calls[0]![1] as unknown[];
    expect(sql).toContain('WHERE id = $1 AND trip_id = $2');
    expect(params).toEqual(['leg-1', 'trip-1']);
  });

  it('throws when no rows are deleted (leg does not belong to trip)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(deleteLeg('leg-1', 'trip-1')).rejects.toThrow(
      'Leg not found or does not belong to this trip',
    );
  });
});

describe('reorderLegs', () => {
  it('is a no-op when given an empty list', async () => {
    await reorderLegs([], 'trip-1');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('pre-flights an ownership check before issuing the UPDATE', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'leg-1' }, { id: 'leg-2' }],
        rowCount: 2,
      } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as never);

    await reorderLegs(['leg-1', 'leg-2'], 'trip-1');

    expect(mockQuery).toHaveBeenCalledTimes(2);
    const ownershipSql = mockQuery.mock.calls[0]![0] as string;
    expect(ownershipSql).toMatch(/SELECT id FROM trip_legs/);
    expect(ownershipSql).toMatch(/trip_id = \$1 AND id = ANY/);
  });

  it('rejects the entire reorder when any leg id is not owned (SEC-01)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'leg-1' }],
      rowCount: 1,
    } as never);

    await expect(reorderLegs(['leg-1', 'leg-2'], 'trip-1')).rejects.toThrow(
      'do not belong to this trip',
    );
    expect(mockQuery).toHaveBeenCalledOnce();
  });

  it('uses parameterized VALUES so leg ids are bound, not interpolated', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'leg-1' }, { id: 'leg-2' }],
        rowCount: 2,
      } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as never);

    await reorderLegs(['leg-1', 'leg-2'], 'trip-1');

    const updateParams = mockQuery.mock.calls[1]![1] as unknown[];
    expect(updateParams).toEqual(['leg-1', 1, 'leg-2', 2, 'trip-1']);
  });
});
