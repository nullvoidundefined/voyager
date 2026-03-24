import type { Request, Response } from "express";

import * as prefsRepo from "app/repositories/userPreferences/userPreferences.js";
import { userPreferencesSchema } from "app/schemas/userPreferences.js";
import { logger } from "app/utils/logs/logger.js";

export async function getPreferences(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const preferences = await prefsRepo.findByUserId(userId);
  res.json({ preferences });
}

export async function upsertPreferences(req: Request, res: Response): Promise<void> {
  const parsed = userPreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join("; ");
    res.status(400).json({ error: { message } });
    return;
  }

  const userId = req.user!.id;
  const preferences = await prefsRepo.upsert(userId, parsed.data);
  logger.info({ event: "preferences_upsert", userId }, "User preferences updated");
  res.json({ preferences });
}
