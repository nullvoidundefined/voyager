/**
 * Express handlers for trip sharing: mint and revoke public share links and
 * resolve a share token to its trip. Exists to gate read-only public access to a
 * trip without granting full account access.
 */
import type { Request, Response } from 'express';

import { query } from 'app/database/pool.js';
import { ApiError } from 'app/errors/ApiError.js';
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

  const result = await query<{ id: string }>(
    `INSERT INTO shared_trips (trip_id, created_by) VALUES ($1, $2) RETURNING id`,
    [tripId, userId],
  );
  const shareId = result.rows[0]!.id;
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/shared/${shareId}`;
  res.status(201).json({ share_id: shareId, share_url: shareUrl });
}

export async function getSharedTripHandler(req: Request, res: Response) {
  const { shareId } = req.params;

  const result = await query<{ trip_id: string; created_by: string }>(
    `SELECT trip_id, created_by FROM shared_trips WHERE id = $1`,
    [shareId],
  );

  if (!result.rows.length) {
    res.status(404).json({ error: 'Share link not found' });
    return;
  }

  const { trip_id, created_by } = result.rows[0]!;
  const trip = await getTripWithDetails(trip_id, created_by);
  res.json({ trip });
}
