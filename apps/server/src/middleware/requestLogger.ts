/**
 * Express request-logging middleware built on pino-http. Assigns a per-request
 * UUID for correlation and emits structured access logs, giving every request a
 * traceable identifier.
 */
import { randomUUID } from 'node:crypto';

import { pinoHttp } from 'pino-http';

import { logger } from 'app/clients/logger.js';

const MAX_REQUEST_ID_LENGTH = 64;

export const requestLogger = pinoHttp({
  genReqId(req, res) {
    const header = req.headers['x-request-id'];
    const fromHeader = Array.isArray(header) ? header[0] : header;
    const raw = fromHeader || randomUUID();
    const id =
      typeof raw === 'string'
        ? raw.slice(0, MAX_REQUEST_ID_LENGTH)
        : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  logger,
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        remoteAddress: req.socket?.remoteAddress,
        url: req.url,
        userAgent: req.headers['user-agent'],
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
