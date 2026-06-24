/**
 * Canonical set of machine-readable API error codes and the ErrorCode union
 * derived from it. A single source of truth so server and client agree on the
 * code set and a typo cannot compile; ApiError.code is typed to ErrorCode.
 */
export const ERROR_CODES = {
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  CONFLICT: 'CONFLICT',
  DAILY_BUDGET_EXCEEDED: 'DAILY_BUDGET_EXCEEDED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
