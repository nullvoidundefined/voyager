import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Guards the deploy contract: the server image must apply migrations before it
// starts, so a deployed schema change reaches the database before traffic. The
// 1779970909000_create-idempotency-keys regression (and the bea33cc5 dist-asset
// class) is why this is asserted in CI, not left to a manual deploy step.
const SERVER_ROOT = path.resolve(process.cwd());
const REPO_ROOT = path.resolve(SERVER_ROOT, '../..');

describe('migrate-on-start deploy contract', () => {
  it('entrypoint script runs node-pg-migrate up before starting the server', () => {
    const script = readFileSync(
      path.join(SERVER_ROOT, 'scripts/migrate-and-start.sh'),
      'utf-8',
    );
    const migrateIndex = script.indexOf('node-pg-migrate up');
    const startIndex = script.indexOf('node apps/server/dist/index.js');
    expect(migrateIndex).toBeGreaterThan(-1);
    expect(startIndex).toBeGreaterThan(-1);
    expect(migrateIndex).toBeLessThan(startIndex);
  });

  it('Dockerfile CMD invokes the migrate-and-start entrypoint', () => {
    const dockerfile = readFileSync(
      path.join(REPO_ROOT, 'Dockerfile.server'),
      'utf-8',
    );
    expect(dockerfile).toContain(
      'CMD ["apps/server/scripts/migrate-and-start.sh"]',
    );
    expect(dockerfile).toContain(
      'COPY apps/server/scripts/migrate-and-start.sh',
    );
  });
});
