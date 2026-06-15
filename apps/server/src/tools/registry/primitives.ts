/**
 * Shared Zod field primitives reused across tool input schemas. Centralizing
 * them keeps the location-input security allowlist (SEC-03) defined once.
 */
import { z } from 'zod';

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

// SEC-03 (2026-04-06 audit): allowlist for location-like fields.
// Accepts unicode letters / numbers / spaces and the punctuation
// legitimately used in place names (comma, period, hyphen,
// apostrophe, parentheses). Rejects shell metachars, HTML / XSS
// characters, URL-structure characters (?, #, /, =), control
// characters, and anything longer than 100 chars. Length cap is
// conservative: the longest real city name ("Krung Thep Maha
// Nakhon..." 168 chars) does not fit, but the world does not need
// Voyager to book trips to Bangkok's full ceremonial name.
export const locationAllowlist = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[\p{L}\p{N} ,.\-'()]+$/u,
    'Must contain only letters, numbers, spaces, and common punctuation',
  );
