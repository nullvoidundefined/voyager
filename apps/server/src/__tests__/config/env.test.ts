import { describe, expect, it } from 'vitest';

import { parseEnv, validateProductionEnv } from 'app/config/env.js';

const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://localhost/db',
  ANTHROPIC_API_KEY: 'sk-ant',
  SERPAPI_API_KEY: 'serp',
  GOOGLE_PLACES_API_KEY: 'goog',
  CORS_ORIGIN: 'https://app.example',
  NEXT_PUBLIC_APP_URL: 'https://app.example',
} as NodeJS.ProcessEnv;

describe('parseEnv', () => {
  it('applies defaults for NODE_ENV and PORT', () => {
    const parsed = parseEnv({});
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(3001);
  });

  it('coerces PORT to a number', () => {
    const parsed = parseEnv({ PORT: '4000' } as NodeJS.ProcessEnv);
    expect(parsed.PORT).toBe(4000);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() =>
      parseEnv({ NODE_ENV: 'staging' } as NodeJS.ProcessEnv),
    ).toThrow();
  });
});

describe('validateProductionEnv', () => {
  it('passes when all production-required keys are present', () => {
    expect(() => validateProductionEnv(parseEnv(PRODUCTION_ENV))).not.toThrow();
  });

  it('throws and names every missing production key', () => {
    const partial = { ...PRODUCTION_ENV };
    delete partial.SERPAPI_API_KEY;
    delete partial.GOOGLE_PLACES_API_KEY;
    expect(() => validateProductionEnv(parseEnv(partial))).toThrow(
      /SERPAPI_API_KEY/,
    );
  });

  it('does not enforce required keys outside production', () => {
    expect(() =>
      validateProductionEnv(parseEnv({ NODE_ENV: 'development' })),
    ).not.toThrow();
  });
});
