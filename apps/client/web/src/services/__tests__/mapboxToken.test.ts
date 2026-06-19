import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getMapboxToken } from '../mapboxToken';

describe('getMapboxToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the token when set', () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test_token';
    expect(getMapboxToken()).toBe('pk.test_token');
  });

  it('throws when NEXT_PUBLIC_MAPBOX_TOKEN is not set', () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    expect(() => getMapboxToken()).toThrow(
      'NEXT_PUBLIC_MAPBOX_TOKEN is not set',
    );
  });
});
