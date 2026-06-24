import { describe, expect, it } from 'vitest';

import { isTransientAnthropicError } from 'app/resilience/isTransientAnthropicError.js';

function errorWithStatus(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function errorWithName(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe('isTransientAnthropicError', () => {
  it.each([408, 429, 500, 502, 503, 504, 529])(
    'treats status %i as transient',
    (status) => {
      expect(isTransientAnthropicError(errorWithStatus(status))).toBe(true);
    },
  );

  it.each([400, 401, 403, 404, 422])(
    'treats client error status %i as non-transient',
    (status) => {
      expect(isTransientAnthropicError(errorWithStatus(status))).toBe(false);
    },
  );

  it.each(['AbortError', 'TimeoutError', 'APIConnectionTimeoutError'])(
    'treats %s (no status) as transient',
    (name) => {
      expect(isTransientAnthropicError(errorWithName(name))).toBe(true);
    },
  );

  it('treats a generic error with no status as non-transient', () => {
    expect(isTransientAnthropicError(new Error('boom'))).toBe(false);
  });
});
