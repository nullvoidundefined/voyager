/**
 * Helper that extracts the authenticated User attached by requireAuth, throwing
 * ApiError when absent. Lets handlers read the current user with a non-nullable
 * type instead of repeating the presence check.
 */
import type { Request } from 'express';

import { ApiError } from 'app/errors/ApiError.js';
import type { User } from 'app/schemas/auth.js';

export function getAuthUser(req: Request): User {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }
  return req.user;
}
