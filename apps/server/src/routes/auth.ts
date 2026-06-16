/**
 * Express router for the auth surface, wiring auth handlers to their paths with
 * the rate limiter and requireAuth guard. Isolates auth route wiring from the
 * handler implementations.
 */
import express from 'express';

import * as authHandlers from 'app/handlers/auth.js';
import { authRateLimiter } from 'app/middleware/rateLimiter.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';

const authRouter = express.Router();

authRouter.post('/register', authRateLimiter, authHandlers.register);
authRouter.post('/login', authRateLimiter, authHandlers.login);
authRouter.post('/logout', authHandlers.logout);
authRouter.get('/me', requireAuth, authHandlers.me);

export { authRouter };
