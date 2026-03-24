import express from "express";

import * as prefsHandlers from "app/handlers/userPreferences/userPreferences.js";
import { requireAuth } from "app/middleware/requireAuth/requireAuth.js";

const userPreferencesRouter = express.Router();

userPreferencesRouter.get("/", requireAuth, prefsHandlers.getPreferences);
userPreferencesRouter.put("/", requireAuth, prefsHandlers.upsertPreferences);

export { userPreferencesRouter };
