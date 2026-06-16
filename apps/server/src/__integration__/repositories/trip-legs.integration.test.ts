import { describe, expect, it } from 'vitest';

import { pool } from 'app/database/pool/pool.js';
import {
  createLeg,
  deleteLeg,
  listLegs,
  reorderLegs,
} from 'app/repositories/trips/tripLegsRepository.js';

import { seedTrip, seedUser } from '../helpers/seed.js';

describe('trip_legs table', () => {
  it('exists with required columns', async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'trip_legs'
       ORDER BY ordinal_position`,
    );
    const cols = result.rows.map((r: { column_name: string }) => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('trip_id');
    expect(cols).toContain('origin');
    expect(cols).toContain('destination');
    expect(cols).toContain('depart_date');
    expect(cols).toContain('leg_order');
  });
});

describe('TripLegsRepository', () => {
  let tripId: string;
  let legId: string;

  it('setup: seed a user and trip', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);
    tripId = trip.id;
  });

  it('createLeg inserts a row and returns it', async () => {
    const leg = await createLeg(tripId, {
      origin: 'NYC',
      destination: 'LAX',
      depart_date: '2026-08-01',
      leg_order: 1,
    });
    expect(leg.id).toBeTruthy();
    expect(leg.origin).toBe('NYC');
    legId = leg.id;
  });

  it('listLegs returns legs ordered by leg_order', async () => {
    await createLeg(tripId, {
      origin: 'LAX',
      destination: 'ORD',
      depart_date: '2026-08-05',
      leg_order: 2,
    });
    const legs = await listLegs(tripId);
    expect(legs.length).toBeGreaterThanOrEqual(2);
    expect(legs[0]!.leg_order).toBeLessThan(legs[1]!.leg_order);
  });

  it('deleteLeg removes the row', async () => {
    await deleteLeg(legId, tripId);
    const legs = await listLegs(tripId);
    expect(legs.find((l) => l.id === legId)).toBeUndefined();
  });

  it('reorderLegs updates leg_order for all provided ids', async () => {
    const a = await createLeg(tripId, {
      origin: 'A',
      destination: 'B',
      depart_date: '2026-09-01',
      leg_order: 1,
    });
    const b = await createLeg(tripId, {
      origin: 'B',
      destination: 'C',
      depart_date: '2026-09-02',
      leg_order: 2,
    });
    await reorderLegs([b.id, a.id], tripId);
    const legs = await listLegs(tripId);
    const aAfter = legs.find((l) => l.id === a.id)!;
    const bAfter = legs.find((l) => l.id === b.id)!;
    expect(bAfter.leg_order).toBeLessThan(aAfter.leg_order);
  });
});

describe('SEC-01: trip_id scoping prevents IDOR on leg delete/reorder', () => {
  it('deleteLeg rejects when the leg belongs to a different trip', async () => {
    const attacker = await seedUser();
    const victim = await seedUser();
    const attackerTrip = await seedTrip(attacker.id);
    const victimTrip = await seedTrip(victim.id);
    const victimLeg = await createLeg(victimTrip.id, {
      origin: 'NYC',
      destination: 'LAX',
      depart_date: '2026-08-01',
      leg_order: 1,
    });

    await expect(deleteLeg(victimLeg.id, attackerTrip.id)).rejects.toThrow(
      /not belong/i,
    );

    const remaining = await listLegs(victimTrip.id);
    expect(remaining.find((l) => l.id === victimLeg.id)).toBeDefined();
  });

  it('reorderLegs rejects when any leg belongs to a different trip', async () => {
    const attacker = await seedUser();
    const victim = await seedUser();
    const attackerTrip = await seedTrip(attacker.id);
    const victimTrip = await seedTrip(victim.id);
    const victimLegA = await createLeg(victimTrip.id, {
      origin: 'NYC',
      destination: 'LAX',
      depart_date: '2026-08-01',
      leg_order: 1,
    });
    const victimLegB = await createLeg(victimTrip.id, {
      origin: 'LAX',
      destination: 'SFO',
      depart_date: '2026-08-05',
      leg_order: 2,
    });

    await expect(
      reorderLegs([victimLegB.id, victimLegA.id], attackerTrip.id),
    ).rejects.toThrow(/not belong/i);

    const after = await listLegs(victimTrip.id);
    const a = after.find((l) => l.id === victimLegA.id)!;
    const b = after.find((l) => l.id === victimLegB.id)!;
    expect(a.leg_order).toBeLessThan(b.leg_order);
  });

  it('reorderLegs rejects when one leg is foreign even if the others are owned', async () => {
    const attacker = await seedUser();
    const victim = await seedUser();
    const attackerTrip = await seedTrip(attacker.id);
    const victimTrip = await seedTrip(victim.id);
    const ownLeg = await createLeg(attackerTrip.id, {
      origin: 'BOS',
      destination: 'NYC',
      depart_date: '2026-09-01',
      leg_order: 1,
    });
    const foreignLeg = await createLeg(victimTrip.id, {
      origin: 'X',
      destination: 'Y',
      depart_date: '2026-09-05',
      leg_order: 1,
    });

    await expect(
      reorderLegs([foreignLeg.id, ownLeg.id], attackerTrip.id),
    ).rejects.toThrow(/not belong/i);
  });
});
