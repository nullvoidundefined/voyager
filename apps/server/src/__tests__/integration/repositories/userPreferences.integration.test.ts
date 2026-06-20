import { describe, expect, it } from 'vitest';

import { seedUser } from 'app/__tests__/integration/helpers/seed.js';
import {
  deleteByUserId,
  findByUserId,
  upsert,
} from 'app/repositories/userPreferences.js';

describe('userPreferences repository integration', () => {
  describe('findByUserId', () => {
    it('returns null for a user with no preferences row', async () => {
      const user = await seedUser();
      const result = await findByUserId(user.id);
      expect(result).toBeNull();
    });

    it('returns normalized preferences after upsert', async () => {
      const user = await seedUser();
      await upsert(user.id, { accommodation: 'budget', schema_version: 1 });

      const result = await findByUserId(user.id);
      expect(result).not.toBeNull();
      expect(result!.accommodation).toBe('budget');
    });
  });

  describe('upsert', () => {
    it('inserts a preferences row on first call', async () => {
      const user = await seedUser();

      const result = await upsert(user.id, {
        accommodation: 'upscale',
        schema_version: 1,
      });

      expect(result.accommodation).toBe('upscale');
    });

    it('merges new keys with existing preferences on second call', async () => {
      const user = await seedUser();

      await upsert(user.id, { accommodation: 'budget', schema_version: 1 });
      const result = await upsert(user.id, {
        travel_pace: 'relaxed',
        schema_version: 1,
      });

      // Both keys should be present after the merge
      expect(result.accommodation).toBe('budget');
      expect(result.travel_pace).toBe('relaxed');
    });

    it('overwrites an existing key when the same key is upserted', async () => {
      const user = await seedUser();

      await upsert(user.id, { accommodation: 'budget', schema_version: 1 });
      const result = await upsert(user.id, {
        accommodation: 'upscale',
        schema_version: 1,
      });

      expect(result.accommodation).toBe('upscale');
    });

    it('concurrent upserts with different keys both persist (no race condition)', async () => {
      const user = await seedUser();

      // Fire two upserts in parallel with distinct keys
      await Promise.all([
        upsert(user.id, { accommodation: 'mid-range', schema_version: 1 }),
        upsert(user.id, { travel_pace: 'packed', schema_version: 1 }),
      ]);

      const result = await findByUserId(user.id);
      expect(result).not.toBeNull();
      // Both keys must be present -- the atomic JSONB merge prevents one from clobbering the other
      expect(result!.accommodation).toBe('mid-range');
      expect(result!.travel_pace).toBe('packed');
    });
  });

  describe('deleteByUserId', () => {
    it('removes the preferences row and returns true', async () => {
      const user = await seedUser();
      await upsert(user.id, { schema_version: 1 });

      const deleted = await deleteByUserId(user.id);
      expect(deleted).toBe(true);

      const result = await findByUserId(user.id);
      expect(result).toBeNull();
    });

    it('returns false when no row exists', async () => {
      const user = await seedUser();
      const result = await deleteByUserId(user.id);
      expect(result).toBe(false);
    });
  });
});
