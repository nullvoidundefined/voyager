/**
 * Express handlers for reading and upserting a user's preferences. Backs the
 * settings surface and keeps preference persistence scoped to the authenticated
 * user.
 */
import type { Request, Response } from 'express';

import { posthog } from 'app/clients/posthog.js';
import { ApiError } from 'app/errors/ApiError.js';
import { getAuthUser } from 'app/middleware/requireAuth/getAuthUser.js';
import { findByUserId, upsert } from 'app/repositories/userPreferences.js';
import { userPreferencesUpdateSchema } from 'app/schemas/userPreferences.js';

export async function getPreferences(req: Request, res: Response) {
  const userId = getAuthUser(req).id;
  const prefs = await findByUserId(userId);
  res.json({ preferences: prefs });
}

export async function upsertPreferences(req: Request, res: Response) {
  const userId = getAuthUser(req).id;

  // Validate values (not just key names) and strip unknown fields at the edge.
  const parsed = userPreferencesUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid preferences', parsed.error.issues);
  }

  const result = await upsert(userId, parsed.data);
  posthog.capture({
    distinctId: userId,
    event: 'user preferences updated',
    properties: { updated_fields: Object.keys(parsed.data) },
  });
  res.json({ preferences: result });
}
