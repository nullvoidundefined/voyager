/**
 * Application error type that carries an HTTP status code, a stable machine
 * code, and optional details, so handlers can throw domain failures and the
 * error middleware can map them to consistent responses.
 */
import { ERROR_CODES } from 'app/constants/errorCodes.js';
import type { ErrorCode } from 'app/constants/errorCodes.js';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, ERROR_CODES.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Insufficient permissions') {
    return new ApiError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static rateLimited(message = 'Too many requests, please try again later') {
    return new ApiError(429, ERROR_CODES.RATE_LIMITED, message);
  }

  static aiServiceError(message = 'AI service temporarily unavailable') {
    return new ApiError(502, ERROR_CODES.AI_SERVICE_ERROR, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, ERROR_CODES.INTERNAL_ERROR, message);
  }
}
