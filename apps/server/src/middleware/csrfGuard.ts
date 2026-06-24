/**
 * Express middleware enforcing header-only CSRF protection. Requires the
 * X-Requested-With header on state-changing requests so cross-site form posts
 * cannot mutate data without the SPA's explicit header, and rejects any present
 * Origin that is not on the shared allowlist as defense-in-depth.
 */
import type { NextFunction, Request, Response } from 'express';

import { isAllowedOrigin } from 'app/config/allowedOrigins.js';

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Rejects state-changing requests that lack X-Requested-With or carry a
 * disallowed Origin. Reduces CSRF risk when using cookie-based sessions with
 * credentials. Frontend must send X-Requested-With: XMLHttpRequest (or any
 * value) on non-GET requests.
 */
export function csrfGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!STATE_CHANGING_METHODS.includes(req.method)) {
    next();
    return;
  }
  const value = req.get('X-Requested-With');
  if (!value) {
    res
      .status(403)
      .json({ error: 'FORBIDDEN', message: 'Missing X-Requested-With header' });
    return;
  }
  const origin = req.get('Origin');
  if (origin && !isAllowedOrigin(origin)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Origin not allowed' });
    return;
  }
  next();
}
