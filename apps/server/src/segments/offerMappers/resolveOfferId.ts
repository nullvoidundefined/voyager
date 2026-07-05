/**
 * Resolves an offer id: persisted legacy tiles already carry ids that must
 * survive normalization; fresh search results get a generated one.
 */
import { randomUUID } from 'crypto';

export function resolveOfferId(id: unknown): string {
  return typeof id === 'string' && id.length > 0 ? id : randomUUID();
}
