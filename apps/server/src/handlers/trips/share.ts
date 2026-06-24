/**
 * Express handlers for trip sharing: mint and revoke public share links and
 * resolve a share token to its trip. Exists to gate read-only public access to a
 * trip without granting full account access.
 */
import type { Request, Response } from 'express';

import { ApiError } from 'app/errors/ApiError.js';
import {
  createShareLink,
  getSharedTripRef,
} from 'app/repositories/sharedTrips.js';
import { getTripWithDetails } from 'app/repositories/trips/trips.js';

export async function createShareHandler(
  req: Request<{ id: string }>,
  res: Response,
) {
  const tripId = req.params.id;
  const userId = req.user?.id ?? '';

  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    throw ApiError.forbidden('You do not have permission to share this trip');
  }

  const shareId = await createShareLink(tripId, userId);
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/shared/${shareId}`;
  res.status(201).json({ share_id: shareId, share_url: shareUrl });
}

export async function getSharedTripHandler(
  req: Request<{ shareId: string }>,
  res: Response,
) {
  const { shareId } = req.params;

  const ref = await getSharedTripRef(shareId);
  if (!ref) {
    res.status(404).json({ error: 'Share link not found' });
    return;
  }

  const trip = await getTripWithDetails(ref.trip_id, ref.created_by);
  res.json({ trip });
}
