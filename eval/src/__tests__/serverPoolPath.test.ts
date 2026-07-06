import { existsSync, readFileSync } from 'fs';
import { globSync } from 'glob';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

import { resolveServerPoolPath } from '../serverPoolPath.js';

function evalRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

describe('resolveServerPoolPath', () => {
  it('points at the post-rename database/pool.js, not the stale db/pool/', () => {
    const poolPath = resolveServerPoolPath();
    expect(
      poolPath.endsWith(join('apps', 'server', 'dist', 'database', 'pool.js')),
    ).toBe(true);
    expect(poolPath).not.toContain(join('dist', 'db'));
  });

  it('resolves to a file that exists after a server build (documented eval prereq)', () => {
    expect(existsSync(resolveServerPoolPath())).toBe(true);
  });
});

it('no eval source still joins the stale dist/db/pool path', () => {
  // The rename bit twice: index.ts (fixed 2026-07-05) and adversarial/index.ts
  // (found 2026-07-06 when Category H died at startup). Pin the whole tree.
  const files = globSync('src/**/*.ts', { cwd: join(evalRoot()) });
  for (const file of files) {
    if (file.includes('__tests__')) continue;
    const content = readFileSync(join(evalRoot(), file), 'utf8');
    expect(
      content,
      `${file} references the pre-rename db/pool path`,
    ).not.toMatch(/'db',\s*'pool'/);
  }
});
