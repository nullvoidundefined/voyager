/**
 * Schema-validated, frozen environment access. Parses process.env once at module
 * load so every call site reads typed, normalized config (with PORT coerced and
 * defaults applied) instead of touching process.env directly. The parse is
 * lenient so importing this module never throws in development or test; boot-time
 * fail-fast for production-critical keys is an explicit validateProductionEnv()
 * call made from startServer(), which throws before the server accepts traffic.
 */
import { z } from 'zod';

// Keys that must be present in production. validateProductionEnv() throws if any
// is missing, so a misconfigured deploy fails at boot rather than mid-request.
const PRODUCTION_REQUIRED_KEYS = [
  'ANTHROPIC_API_KEY',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'GOOGLE_PLACES_API_KEY',
  'NEXT_PUBLIC_APP_URL',
  'SERPAPI_API_KEY',
] as const;

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3001),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().optional(),
  REDIS_URL: z.string().optional(),
  SERPAPI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Parses and normalizes a raw environment map. Exported for unit testing. */
export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  return envSchema.parse(raw);
}

export const env: Readonly<Env> = Object.freeze(parseEnv(process.env));

/** Throws when a production-required key is missing. Call at boot in startServer(). */
export function validateProductionEnv(target: Env = env): void {
  if (target.NODE_ENV !== 'production') return;
  const missing = PRODUCTION_REQUIRED_KEYS.filter((key) => !target[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`,
    );
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
