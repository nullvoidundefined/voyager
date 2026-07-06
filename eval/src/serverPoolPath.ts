/**
 * Resolves the built server database pool module the eval harness imports for
 * direct DB access. Centralized so the path is testable: a stale segment here
 * (the pre-rename dist/db/pool/pool.js) broke every eval run silently.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveServerPoolPath(): string {
  const evalSrcDir = dirname(fileURLToPath(import.meta.url));
  return join(
    evalSrcDir,
    '..',
    '..',
    'apps',
    'server',
    'dist',
    'database',
    'pool.js',
  );
}
