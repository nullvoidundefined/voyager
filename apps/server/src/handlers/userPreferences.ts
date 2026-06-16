/**
 * Express handlers for reading and upserting a user's preferences. Backs the
 * settings surface and keeps preference persistence scoped to the authenticated
 * user.
 */
import type { Request, Response } from 'express';

import { posthog } from 'app/clients/posthog.js';
import { getAuthUser } from 'app/middleware/requireAuth/getAuthUser.js';
import { findByUserId, upsert } from 'app/repositories/userPreferences.js';

export async function getPreferences(req: Request, res: Response) {
  const userId = getAuthUser(req).id;
  const prefs = await findByUserId(userId);
  res.json({ preferences: prefs });
}

export async function upsertPreferences(req: Request, res: Response) {
  const userId = getAuthUser(req).id;
  const input = req.body as Record<string, unknown>;

  // Validate: only allow known preference fields
  const allowedFields = [
    'accommodation',
    'travel_pace',
    'dietary',
    'dining_style',
    'activities',
    'travel_party',
    'budget_comfort',
    'completed_steps',
    'schema_version',
  ];
  const filtered: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in input) {
      filtered[key] = input[key];
    }
  }

  const result = await upsert(userId, filtered);
  posthog.capture({
    distinctId: userId,
    event: 'user preferences updated',
    properties: { updated_fields: Object.keys(filtered) },
  });
  res.json({ preferences: result });
}
