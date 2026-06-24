/**
 * Single source of truth for which request Origins are trusted. Shared by the
 * CORS middleware and the CSRF guard so both enforce the same allowlist instead
 * of each keeping its own copy. Built from CORS_ORIGIN, plus private-network
 * (LAN) origins in non-production so local devices can reach the dev server.
 */
const DEFAULT_DEV_ORIGIN = 'http://localhost:5173';

const LOCAL_NETWORK_RE =
  /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const allowedOrigins = (process.env.CORS_ORIGIN ?? DEFAULT_DEV_ORIGIN)
  .split(',')
  .map((origin) => origin.trim());

export function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  if (process.env.NODE_ENV !== 'production' && LOCAL_NETWORK_RE.test(origin)) {
    return true;
  }
  return false;
}
