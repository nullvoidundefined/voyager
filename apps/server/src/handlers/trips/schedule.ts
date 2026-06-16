/**
 * Express handlers for a trip's day-by-day schedule. Exposes the schedule
 * read/write surface while keeping ownership checks at the handler boundary.
 */
import type { Request, Response } from 'express';

import { ApiError } from 'app/errors/ApiError.js';
import { getAuthUser } from 'app/middleware/requireAuth/getAuthUser.js';
import { getScheduleForTrip } from 'app/repositories/trips/scheduleRepository.js';
import { getTripWithDetails } from 'app/repositories/trips/trips.js';

export async function getScheduleHandler(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const { id: userId } = getAuthUser(req);
  const tripId = req.params.id;

  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    throw ApiError.forbidden('You do not have permission to view this trip');
  }

  const days = await getScheduleForTrip(tripId);
  res.json({ days });
}
