import { describe, expect, it, vi } from 'vitest';

import {
  handleAddLeg,
  handleRemoveLeg,
  handleReorderLegs,
} from '../legsTool.js';

const mockCreate = vi.fn().mockResolvedValue({
  id: 'leg-1',
  origin: 'NYC',
  destination: 'LAX',
  depart_date: '2026-08-01',
  leg_order: 1,
});
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockReorder = vi.fn().mockResolvedValue(undefined);
const mockList = vi.fn().mockResolvedValue([]);

const adapters = {
  createLeg: mockCreate,
  listLegs: mockList,
  deleteLeg: mockDelete,
  reorderLegs: mockReorder,
};

describe('add_leg tool', () => {
  it('calls createLeg with tripId and input fields', async () => {
    const result = await handleAddLeg(
      {
        origin: 'NYC',
        destination: 'LAX',
        depart_date: '2026-08-01',
        leg_order: 1,
      },
      { tripId: 'trip-1', userId: 'user-1' },
      adapters,
    );
    expect(mockCreate).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ origin: 'NYC' }),
    );
    expect(result.leg.id).toBe('leg-1');
  });
});

describe('remove_leg tool', () => {
  it('calls deleteLeg with leg_id AND tripId from context (SEC-01)', async () => {
    await handleRemoveLeg(
      { leg_id: 'leg-1' },
      { tripId: 'trip-1', userId: 'user-1' },
      adapters,
    );
    expect(mockDelete).toHaveBeenCalledWith('leg-1', 'trip-1');
  });
});

describe('reorder_legs tool', () => {
  it('calls reorderLegs with valid UUID ids and tripId from context (SEC-01)', async () => {
    const id1 = '00000000-0000-4000-8000-000000000001';
    const id2 = '00000000-0000-4000-8000-000000000002';
    await handleReorderLegs(
      { ordered_leg_ids: [id1, id2] },
      { tripId: 'trip-1', userId: 'user-1' },
      adapters,
    );
    expect(mockReorder).toHaveBeenCalledWith([id1, id2], 'trip-1');
  });

  it('rejects non-UUID leg ids (SQL injection guard)', async () => {
    await expect(
      handleReorderLegs(
        { ordered_leg_ids: ["x'); DROP TABLE trip_legs;--"] },
        { tripId: 'trip-1', userId: 'user-1' },
        adapters,
      ),
    ).rejects.toThrow(/invalid|uuid/i);
  });

  it('rejects an empty ordered_leg_ids array', async () => {
    await expect(
      handleReorderLegs(
        { ordered_leg_ids: [] },
        { tripId: 'trip-1', userId: 'user-1' },
        adapters,
      ),
    ).rejects.toThrow();
  });
});
