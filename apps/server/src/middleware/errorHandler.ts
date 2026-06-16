/**
 * Terminal Express error-handling middleware. Maps thrown errors (notably
 * ApiError) to consistent JSON responses and logs unexpected failures, keeping
 * error shaping out of individual handlers.
 */
import type { NextFunction, Request, Response } from 'express';

import { logger } from 'app/clients/logger.js';
import { posthog } from 'app/clients/posthog.js';
import { ApiError } from 'app/errors/ApiError.js';

// Centralized error handler to ensure all uncaught errors are logged once and surfaced with a safe JSON response.
// The full error is only exposed in non-production environments to avoid leaking implementation details.

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    logger.error({ err, reqId: req.id }, 'Request error');
    const body: { error: string; message: string; details?: unknown } = {
      error: err.code,
      message: err.message,
    };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err, reqId: req.id }, 'Unhandled error in request handler');
  posthog.captureException(err, req.user?.id, {
    url: req.originalUrl,
    method: req.method,
  });

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : 'Internal server error',
  });
}
