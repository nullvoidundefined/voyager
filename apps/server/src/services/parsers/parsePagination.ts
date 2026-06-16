/**
 * Parses and clamps list-endpoint pagination params into a safe { limit, offset },
 * applying defaults and a maximum limit. Exists to keep pagination bounds
 * consistent and prevent oversized queries across handlers.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function parsePagination(
  limitParam: unknown,
  offsetParam: unknown,
): { limit: number; offset: number } {
  const rawLimit =
    limitParam === undefined || limitParam === ''
      ? undefined
      : Number(limitParam);
  const limit =
    rawLimit === undefined || Number.isNaN(rawLimit)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(1, Math.floor(rawLimit)), MAX_LIMIT);
  const rawOffset =
    offsetParam === undefined || offsetParam === '' ? 0 : Number(offsetParam);
  const offset = Math.max(
    0,
    Number.isNaN(rawOffset) ? 0 : Math.floor(rawOffset),
  );
  return { limit, offset };
}
