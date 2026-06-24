/**
 * Opt-in safe-retry guard for non-streaming authenticated state-changing routes.
 * Reads the Idempotency-Key header; replays a stored response within the 24h TTL,
 * otherwise transparently captures res.json and persists the successful response.
 * Mount ONLY on non-streaming routes: it wraps res.json and is incompatible with
 * SSE (the chat stream). A request without the header or without an authenticated
 * user passes straight through, so the guard is a no-op until a client opts in.
 */
import type { NextFunction, Request, Response } from 'express';

import { logger } from 'app/clients/logger.js';
import {
  findIdempotentResponse,
  saveIdempotentResponse,
} from 'app/repositories/idempotency.js';

export async function idempotencyGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = req.header('Idempotency-Key');
  const userId = req.user?.id;

  if (!key || !userId) {
    next();
    return;
  }

  try {
    const stored = await findIdempotentResponse(userId, key);
    if (stored) {
      res.status(stored.responseStatus).json(stored.responseBody);
      return;
    }
  } catch (err) {
    logger.error({ err, reqId: req.id }, 'Idempotency lookup failed');
    next();
    return;
  }

  captureSuccessfulResponse(req, res, userId, key);
  next();
}

/**
 * Wraps res.json so a successful response is persisted for replay. Only statuses
 * below 400 are stored: errorHandler serializes failures through this same
 * res.json, so storing a transient 5xx (or a 4xx) would replay it for the full
 * TTL and lock out the retries this guard exists to enable. Concurrency note: two
 * simultaneous requests with the same key both miss the lookup and run the
 * handler; ON CONFLICT DO NOTHING persists only the first, de-duping sequential
 * retries.
 */
function captureSuccessfulResponse(
  req: Request,
  res: Response,
  userId: string,
  key: string,
): void {
  const originalJson = res.json.bind(res) as Response['json'];
  res.json = (body: unknown): Response => {
    if (res.statusCode < 400) {
      void saveIdempotentResponse(userId, key, res.statusCode, body).catch(
        (err) => {
          logger.error({ err, reqId: req.id }, 'Idempotency save failed');
        },
      );
    }
    return originalJson(body);
  };
}
