/**
 * Multi-leg itinerary tool handlers: add, remove, and reorder the trip legs that
 * model a multi-city journey. Each handler takes an adapters object so the
 * executor injects the real repository functions and tests inject doubles,
 * keeping these handlers free of direct database coupling.
 */
import { z } from 'zod';

import type {
  CreateLegInput,
  TripLeg,
} from 'app/repositories/trips/tripLegsRepository.js';

import type { ToolContext } from './executor.js';

const reorderLegsInputSchema = z.object({
  ordered_leg_ids: z
    .array(z.string().uuid('each leg_id must be a valid UUID'))
    .min(1, 'ordered_leg_ids must not be empty'),
});

export interface LegsAdapters {
  createLeg: (tripId: string, input: CreateLegInput) => Promise<TripLeg>;
  listLegs: (tripId: string) => Promise<TripLeg[]>;
  deleteLeg: (legId: string, tripId: string) => Promise<void>;
  reorderLegs: (orderedIds: string[], tripId: string) => Promise<void>;
}

export async function handleAddLeg(
  input: {
    origin: string;
    destination: string;
    depart_date: string;
    leg_order: number;
  },
  ctx: ToolContext,
  adapters: LegsAdapters,
) {
  const leg = await adapters.createLeg(ctx.tripId, input);
  return { leg };
}

export async function handleRemoveLeg(
  input: { leg_id: string },
  ctx: ToolContext,
  adapters: LegsAdapters,
) {
  await adapters.deleteLeg(input.leg_id, ctx.tripId);
  return { deleted: input.leg_id };
}

export async function handleReorderLegs(
  input: { ordered_leg_ids: string[] },
  ctx: ToolContext,
  adapters: LegsAdapters,
) {
  const parsed = reorderLegsInputSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ');
    throw new Error(`Invalid reorder_legs input: ${message}`);
  }
  await adapters.reorderLegs(parsed.data.ordered_leg_ids, ctx.tripId);
  return { reordered: true };
}
