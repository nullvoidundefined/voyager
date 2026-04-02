import crypto from 'node:crypto';

/** Returns a new UUID v4 for use in tests. Optional index param is ignored (allows unique call sites). */

export function uuid(_index?: number): string {
  return crypto.randomUUID();
}
