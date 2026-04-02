import { query } from 'app/db/pool/pool.js';
import * as prefsRepo from 'app/repositories/userPreferences/userPreferences.js';
import { mockResult } from 'app/utils/tests/mockResult.js';
import { uuid } from 'app/utils/tests/uuids.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/db/pool/pool.js', () => {
  const queryFn = vi.fn();
  return {
    query: queryFn,
    withTransaction: vi.fn((fn: (client: unknown) => Promise<unknown>) =>
      fn({}),
    ),
  };
});

const mockQuery = vi.mocked(query);

describe('userPreferences repository', () => {
  const userId = uuid();
  const prefId = uuid();

  const row = {
    id: prefId,
    user_id: userId,
    dietary: ['vegetarian', 'gluten-free'],
    intensity: 'active',
    social: 'couple',
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('returns preferences when found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([row]));

      const result = await prefsRepo.findByUserId(userId);

      expect(result).toEqual(row);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [userId],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));

      const result = await prefsRepo.findByUserId(userId);

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('inserts or updates preferences and returns the row', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([row]));

      const input = {
        dietary: ['vegetarian', 'gluten-free'] as (
          | 'vegetarian'
          | 'gluten-free'
        )[],
        intensity: 'active' as const,
        social: 'couple' as const,
      };
      const result = await prefsRepo.upsert(userId, input);

      expect(result).toEqual(row);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (user_id)'),
        [userId, input.dietary, input.intensity, input.social],
      );
    });
  });

  describe('deleteByUserId', () => {
    it('returns true when deleted', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([], 1));

      const result = await prefsRepo.deleteByUserId(userId);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_preferences'),
        [userId],
      );
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([], 0));

      const result = await prefsRepo.deleteByUserId(userId);

      expect(result).toBe(false);
    });
  });
});
