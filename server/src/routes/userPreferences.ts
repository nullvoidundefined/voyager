import * as prefsHandlers from 'app/handlers/userPreferences/userPreferences.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const userPreferencesRouter = express.Router();

userPreferencesRouter.get('/', requireAuth, prefsHandlers.getPreferences);
userPreferencesRouter.put('/', requireAuth, prefsHandlers.upsertPreferences);

export { userPreferencesRouter };
