import type { Request, Response } from 'express';
import { z } from 'zod';

import { ApiError } from 'app/errors/ApiError.js';
import { getAuthUser } from 'app/middleware/requireAuth/getAuthUser.js';
import {
  createLeg,
  deleteLeg,
  listLegs as listLegsRepo,
  reorderLegs as reorderLegsRepo,
} from 'app/repositories/trips/tripLegsRepository.js';
import { getTripWithDetails } from 'app/repositories/trips/trips.js';

const addLegSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  depart_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leg_order: z.number().int().positive(),
});

const reorderLegsSchema = z.object({
  ordered_leg_ids: z.array(z.string().uuid()).min(1),
});

async function assertTripOwnership(
  tripId: string,
  userId: string,
): Promise<void> {
  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    throw ApiError.forbidden('You do not have permission to modify this trip');
  }
}

export async function listLegs(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const { id: userId } = getAuthUser(req);
  await assertTripOwnership(req.params.id, userId);
  const legs = await listLegsRepo(req.params.id);
  res.json({ legs });
}

export async function addLeg(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const { id: userId } = getAuthUser(req);
  await assertTripOwnership(req.params.id, userId);
  const parsed = addLegSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ');
    throw ApiError.badRequest(message);
  }
  const leg = await createLeg(req.params.id, parsed.data);
  res.status(201).json({ leg });
}

export async function removeLeg(
  req: Request<{ id: string; legId: string }>,
  res: Response,
): Promise<void> {
  const { id: userId } = getAuthUser(req);
  await assertTripOwnership(req.params.id, userId);
  try {
    await deleteLeg(req.params.legId, req.params.id);
  } catch {
    throw ApiError.notFound('Leg not found');
  }
  res.status(204).end();
}

export async function reorderLegs(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const { id: userId } = getAuthUser(req);
  await assertTripOwnership(req.params.id, userId);
  const parsed = reorderLegsSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ');
    throw ApiError.badRequest(message);
  }
  try {
    await reorderLegsRepo(parsed.data.ordered_leg_ids, req.params.id);
  } catch {
    throw ApiError.notFound('One or more legs not found');
  }
  res.json({ reordered: true });
}
