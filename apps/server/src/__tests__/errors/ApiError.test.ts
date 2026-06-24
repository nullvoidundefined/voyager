import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from 'app/constants/errorCodes.js';
import { ApiError } from 'app/errors/ApiError.js';

describe('ApiError', () => {
  it('carries the canonical code and status for each factory', () => {
    expect(ApiError.badRequest('x').code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(ApiError.unauthorized().statusCode).toBe(401);
    expect(ApiError.forbidden().code).toBe(ERROR_CODES.FORBIDDEN);
    expect(ApiError.notFound().code).toBe(ERROR_CODES.NOT_FOUND);
    expect(ApiError.rateLimited().code).toBe(ERROR_CODES.RATE_LIMITED);
    expect(ApiError.internal().code).toBe(ERROR_CODES.INTERNAL_ERROR);
  });

  it('every code value matches its key (no drift in the registry)', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });
});
