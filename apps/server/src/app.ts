/**
 * Express application setup and server bootstrap. Wires middleware, static
 * assets, and route handlers into the app and exposes startServer, so the
 * HTTP surface is assembled in one place separate from the process entry point.
 */
// Static destinations data: public, aggressively cached
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';

import {
  type MockScenarioName,
  isAnthropicMockMode,
  setMockScenario,
} from 'app/__fixtures__/mockAnthropicClient/mockAnthropicClient.js';
import { logger } from 'app/clients/logger.js';
import { posthog } from 'app/clients/posthog.js';
import { corsConfig } from 'app/config/corsConfig.js';
import { readDeployedCommit } from 'app/config/deployedCommit.js';
import { env, validateProductionEnv } from 'app/config/env.js';
import { pool, query } from 'app/database/pool.js';
import { getSharedTripHandler } from 'app/handlers/trips/share.js';
import { csrfGuard } from 'app/middleware/csrfGuard.js';
import { errorHandler } from 'app/middleware/errorHandler.js';
import { notFoundHandler } from 'app/middleware/notFoundHandler.js';
import { rateLimiter } from 'app/middleware/rateLimiter.js';
import { requestLogger } from 'app/middleware/requestLogger.js';
import { loadSession } from 'app/middleware/requireAuth/requireAuth.js';
import { deleteExpiredSessions } from 'app/repositories/auth.js';
import { deleteExpiredIdempotencyKeys } from 'app/repositories/idempotency.js';
import { authRouter } from 'app/routes/auth.js';
import { placesRouter } from 'app/routes/places.js';
import { tripRouter } from 'app/routes/trips.js';
import { userPreferencesRouter } from 'app/routes/userPreferences.js';

function readCommitSha(): string {
  const versionPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    'data/version.json',
  );
  return readDeployedCommit(versionPath);
}

function validateEnv(): void {
  if (!env.DATABASE_URL) {
    console.error('Fatal: DATABASE_URL is required');
    process.exit(1);
  }
  try {
    validateProductionEnv();
  } catch (err) {
    console.error(`Fatal: ${(err as Error).message}`);
    process.exit(1);
  }
}

const app = express();
export { app };
const REQUEST_TIMEOUT_MS = 30_000;

// Trust the first hop (reverse proxy / load balancer) so req.ip, req.protocol, and rate limiting work
// correctly with X-Forwarded-For / X-Forwarded-Proto headers. Set to the number of trusted proxy hops.
app.set('trust proxy', 1);

// Add security-related HTTP headers to reduce common web vulnerabilities (XSS, clickjacking, MIME sniffing, etc.).
app.use(helmet());

// Allow browser frontends to call this API while still controlling which origins are permitted.
app.use(corsConfig);

// Attach structured request/response logging (with request IDs) early so all downstream handlers are observable.
app.use(requestLogger);

// Apply a basic rate limiter to protect the API from simple abuse and accidental client floods.
app.use(rateLimiter);

// Parse JSON request bodies and cap payload size to avoid unexpectedly large requests.
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded form submissions (e.g. HTML forms) with the same size cap as JSON.
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(cookieParser());

// Require X-Requested-With on state-changing requests to mitigate CSRF.
app.use(csrfGuard);

// Load session from cookie and set req.user when valid (does not block unauthenticated requests).
app.use(loadSession);

// Timeout long-running requests so hung connections don't stay open indefinitely.
app.use((_req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res
        .status(408)
        .json({ error: 'REQUEST_TIMEOUT', message: 'Request timeout' });
    }
  });
  next();
});

// DB health check moved into startServer() for test isolation

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/health/ready', async (_req, res) => {
  let dbStatus = 'disconnected';
  let cacheStatus = 'unavailable';

  try {
    await query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    // DB check failed
  }

  try {
    const { getRedis } = await import('app/services/cache/cacheService.js');
    const redis = getRedis();
    if (redis) {
      await redis.ping();
      cacheStatus = 'connected';
    }
  } catch {
    cacheStatus = 'degraded';
  }

  let activeConversations = 0;
  try {
    const { getActiveConversationCount } =
      await import('app/handlers/chat/chat.js');
    activeConversations = getActiveConversationCount();
  } catch {
    // Module not loaded yet
  }

  const status = dbStatus === 'connected' ? 'ok' : 'degraded';
  const statusCode = dbStatus === 'connected' ? 200 : 503;
  res.status(statusCode).json({
    status,
    db: dbStatus,
    cache: cacheStatus,
    activeConversations,
    commit: readCommitSha(),
  });
});

const destinationsPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  'data/destinations.json',
);
let destinationsData: unknown;
try {
  destinationsData = JSON.parse(fs.readFileSync(destinationsPath, 'utf-8'));
} catch (err) {
  // The bea33cc5 retrospective covered this: tsc does not transitively
  // copy JSON assets, so a missing dist/data/destinations.json at boot
  // means the build smoke step failed silently. Fail loudly here.
  console.error(
    `Fatal: failed to load ${destinationsPath} at boot. Did the build copy JSON assets to dist/?`,
    err,
  );
  process.exit(1);
}
app.get('/destinations', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json(destinationsData);
});

app.use('/auth', authRouter);
app.use('/places', placesRouter);
app.use('/trips', tripRouter);
app.use('/user-preferences', userPreferencesRouter);

// Public route -- no auth required
app.get('/shared/:shareId', getSharedTripHandler);

// Test-only endpoint to switch the mock Anthropic scenario.
// Double-gated: only registered outside production AND only responds
// when E2E_MOCK_ANTHROPIC=1.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/test/mock-scenario', (req, res) => {
    if (!isAnthropicMockMode()) {
      res.status(404).json({ error: 'Not available outside mock mode' });
      return;
    }
    const VALID_SCENARIOS: MockScenarioName[] = [
      'default',
      'selection',
      'selectFlight',
    ];
    const { scenario } = req.body as { scenario?: string };
    if (!VALID_SCENARIOS.includes(scenario as MockScenarioName)) {
      res.status(400).json({
        error: `Invalid scenario. Must be one of: ${VALID_SCENARIOS.join(', ')}.`,
      });
      return;
    }
    setMockScenario(scenario as MockScenarioName);
    res.status(200).json({ scenario });
  });
}

// Attach reusable utilities for 404 and error handling.
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';

export function startServer(): void {
  validateEnv();

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected idle-client error in pg pool');
  });

  query('SELECT NOW()')
    .then(() => logger.info('Connected to database'))
    .catch((err: unknown) =>
      logger.error({ err }, 'Database connection failed'),
    );

  scheduleExpiryCleanup();

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception – shutting down');
    logger.flush();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    // Pino's default serializer drops Error.message/stack from
    // bare `reason` objects, leaving us with `{}` in CI logs.
    // Normalize to a shape Pino will fully serialize.
    const err =
      reason instanceof Error
        ? reason
        : new Error(
            typeof reason === 'string' ? reason : JSON.stringify(reason),
          );
    logger.fatal(
      { err, reasonRaw: reason },
      'Unhandled rejection - shutting down',
    );
    logger.flush();
    process.exit(1);
  });

  const server = app.listen(PORT, HOST, () =>
    logger.info({ port: PORT }, 'Server running'),
  );

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down gracefully');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    logger.info('HTTP server closed');
    await pool.end();
    await posthog.shutdown();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/** Hourly sweep dropping expired sessions and idempotency keys from the database. */
function scheduleExpiryCleanup(): void {
  setInterval(() => {
    runCleanupSweep('expired sessions', deleteExpiredSessions);
    runCleanupSweep('expired idempotency keys', deleteExpiredIdempotencyKeys);
  }, CLEANUP_INTERVAL_MS);
}

/** Runs one cleanup query, logging the removed count and swallowing failures. */
function runCleanupSweep(label: string, sweep: () => Promise<number>): void {
  sweep()
    .then((count) => {
      if (count > 0) {
        logger.info({ count }, `Cleaned up ${label}`);
      }
    })
    .catch((err: unknown) => {
      logger.error({ err }, `Failed to clean up ${label}`);
    });
}
