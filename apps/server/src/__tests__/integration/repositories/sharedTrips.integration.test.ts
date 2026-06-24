import { describe, expect, it } from 'vitest';

import { seedTrip, seedUser } from 'app/__tests__/integration/helpers/seed.js';
import { pool } from 'app/database/pool.js';
import {
  createShareLink,
  getSharedTripRef,
} from 'app/repositories/sharedTrips.js';

describe('sharedTrips repository integration', () => {
  it('returns the same share id on repeated calls (idempotent)', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);

    const first = await createShareLink(trip.id, user.id);
    const second = await createShareLink(trip.id, user.id);

    expect(second).toBe(first);
    const rows = await pool.query(
      'SELECT COUNT(*)::int AS count FROM shared_trips WHERE trip_id = $1 AND created_by = $2',
      [trip.id, user.id],
    );
    expect(rows.rows[0].count).toBe(1);
  });

  it('resolves a share id back to its trip reference', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);

    const shareId = await createShareLink(trip.id, user.id);
    const ref = await getSharedTripRef(shareId);

    expect(ref).toEqual({ trip_id: trip.id, created_by: user.id });
  });

  it('returns null for an unknown share id', async () => {
    const ref = await getSharedTripRef('00000000-0000-0000-0000-000000000000');
    expect(ref).toBeNull();
  });
});
