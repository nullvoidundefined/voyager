/**
 * Express router for the trips surface, composing trip, leg, cost, schedule,
 * share, and chat handlers under one router. Centralizes trip route wiring and
 * its auth guards apart from the handler logic.
 */
import express from 'express';

import * as chatHandlers from 'app/handlers/chat/chat.js';
import * as costsHandlers from 'app/handlers/trips/costs.js';
import * as legsHandlers from 'app/handlers/trips/legs.js';
import * as scheduleHandlers from 'app/handlers/trips/schedule.js';
import * as shareHandlers from 'app/handlers/trips/share.js';
import * as tripHandlers from 'app/handlers/trips/trips.js';
import { idempotencyGuard } from 'app/middleware/idempotencyGuard.js';
import { chatRateLimiter } from 'app/middleware/rateLimiter.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';

const tripRouter = express.Router();

tripRouter.use(requireAuth);

// Idempotency-Key is honored on the non-streaming mutation routes below so a
// retried or double-submitted write runs at most once. NOT applied to the SSE
// chat route, which is incompatible with the res.json-wrapping guard.
tripRouter.post('/', idempotencyGuard, tripHandlers.createTrip);
tripRouter.get('/', tripHandlers.listTrips);
tripRouter.get('/:id', tripHandlers.getTrip);
tripRouter.put('/:id', tripHandlers.updateTrip);
tripRouter.delete('/:id', tripHandlers.deleteTrip);

// B14: persist a single tile-card selection directly from the frontend.
tripRouter.post('/:id/selections', idempotencyGuard, tripHandlers.selectItem);

// Test-only seam (ENG-17). The handler returns 404 unless
// E2E_BYPASS_RATE_LIMITS=1, and the route is not registered at all
// in production. Double gate: route registration + handler check.
if (process.env.NODE_ENV !== 'production') {
  tripRouter.post('/:id/test-selections', tripHandlers.seedSelections);
}

tripRouter.get('/:id/schedule', scheduleHandlers.getScheduleHandler);

tripRouter.get('/:id/legs', legsHandlers.listLegs);
tripRouter.post('/:id/legs', legsHandlers.addLeg);
tripRouter.put('/:id/legs/reorder', legsHandlers.reorderLegs);
tripRouter.delete('/:id/legs/:legId', legsHandlers.removeLeg);

tripRouter.post('/:id/chat', chatRateLimiter, chatHandlers.chat);
tripRouter.get('/:id/messages', chatHandlers.getMessages);

tripRouter.post(
  '/:id/share',
  idempotencyGuard,
  shareHandlers.createShareHandler,
);
tripRouter.get('/:id/costs', costsHandlers.getTripCostsHandler);

export { tripRouter };
