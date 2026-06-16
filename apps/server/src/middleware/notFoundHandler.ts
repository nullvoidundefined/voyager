/**
 * Express middleware that returns a consistent JSON 404 for any unmatched route,
 * so API clients always receive JSON rather than Express's default HTML page.
 */
import type { Request, Response } from 'express';

// Return a consistent JSON response for any unmatched route instead of the default HTML 404.
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Not found',
  });
}
