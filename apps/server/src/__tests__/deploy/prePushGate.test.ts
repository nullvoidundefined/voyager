import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Guards that the pre-push hook actually runs unit tests locally. The 2026-06-24
// engineering audit (P2-08) found pre-push ran format/lint/build but no tests,
// so coverage regressions surfaced only in CI.
const REPO_ROOT = path.resolve(process.cwd(), '../..');

describe('pre-push test gate', () => {
  const lefthook = readFileSync(path.join(REPO_ROOT, 'lefthook.yml'), 'utf-8');

  it('runs the server coverage suite on pre-push', () => {
    expect(lefthook).toContain('pnpm test:coverage');
  });

  it('runs the web unit suite on pre-push', () => {
    expect(lefthook).toContain('pnpm --filter voyager-web run test');
  });
});
