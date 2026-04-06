import { photoProxyHandler } from 'app/handlers/places/photoProxy.handler.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const placesRouter = express.Router();

// SEC-01 (2026-04-06 audit): the photo proxy previously had no auth
// gate, which meant any anonymous visitor could drain the paid
// GOOGLE_PLACES_API_KEY quota by issuing arbitrary /places/photo
// requests through the server. Requiring auth limits abuse to
// registered users, who are already rate-limited.
placesRouter.get('/photo', requireAuth, photoProxyHandler);

export { placesRouter };
