import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { getAuthUser } from 'app/middleware/requireAuth/getAuthUser.js';

describe('getAuthUser', () => {
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    created_at: new Date(),
    updated_at: null,
  };

  it('returns the user when req.user is defined', () => {
    const req = { user: mockUser } as Request;
    const result = getAuthUser(req);
    expect(result).toBe(mockUser);
    expect(result.id).toBe('123');
  });

  it('throws ApiError.unauthorized when req.user is undefined', () => {
    const req = {} as Request;
    expect(() => getAuthUser(req)).toThrow();
    try {
      getAuthUser(req);
    } catch (err: unknown) {
      expect((err as { statusCode: number }).statusCode).toBe(401);
    }
  });

  it('return type is User, not User | undefined', () => {
    const req = { user: mockUser } as Request;
    const user = getAuthUser(req);
    const id: string = user.id;
    expect(id).toBe('123');
  });
});
