/**
 * Pulls the raw item list out of a search tool's result payload, which may be
 * a bare array (mock fixtures) or an object keyed by the capability's
 * resultListKey (live tools). Shared by tile building and KB write-back.
 */
export function extractResultItems(result: unknown, key: string): unknown[] {
  if (Array.isArray(result)) return result;
  if (result == null || typeof result !== 'object') return [];
  const data = result as Record<string, unknown>;
  if (Array.isArray(data[key])) return data[key] as unknown[];
  return [];
}
