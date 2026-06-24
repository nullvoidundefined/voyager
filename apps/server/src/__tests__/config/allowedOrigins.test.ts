import { describe, expect, it } from 'vitest';

import { isAllowedOrigin } from 'app/config/allowedOrigins.js';

// CORS_ORIGIN is unset in the test environment, so the module falls back to its
// default dev origin; NODE_ENV is 'test', so the LAN allowance is active.
describe('isAllowedOrigin', () => {
  it('allows the configured/default origin', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
  });

  it('rejects an unlisted origin', () => {
    expect(isAllowedOrigin('http://evil.example')).toBe(false);
  });

  it('allows a private-network origin outside production', () => {
    expect(isAllowedOrigin('http://192.168.1.20:3000')).toBe(true);
  });
});
