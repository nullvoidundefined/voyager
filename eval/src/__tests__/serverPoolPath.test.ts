import { existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { resolveServerPoolPath } from '../serverPoolPath.js';

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
