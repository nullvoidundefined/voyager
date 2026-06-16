/**
 * Shared pino logger singleton used across every server layer so log output is
 * structured JSON in production and human-readable in development. Centralized
 * here to keep the level and transport configuration in one place.
 */
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: isProd ? 'info' : 'debug',
  // base structured JSON logs in all environments
  ...(isProd
    ? {}
    : {
        // pretty-print only in development
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});
