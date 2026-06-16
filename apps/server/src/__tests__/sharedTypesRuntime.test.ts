import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('shared-types runtime contract', () => {
  it('Node ESM can import @voyager/shared-types and read ACCOMMODATION_OPTIONS', () => {
    const probe = [
      "import('@voyager/shared-types').then(m => {",
      '  if (!Array.isArray(m.ACCOMMODATION_OPTIONS) || m.ACCOMMODATION_OPTIONS.length === 0) {',
      "    console.error('missing-runtime-export');",
      '    process.exit(2);',
      '  }',
      '}).catch(err => {',
      '  console.error(err.code || err.message);',
      '  process.exit(3);',
      '});',
    ].join('\n');

    const result = spawnSync(process.execPath, ['-e', probe], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
