import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Guards that the declared Node runtime stays consistent across .node-version,
// the root engines field, and the server Dockerfile base image, so local
// toolchains and the production image cannot silently drift onto different
// majors.
const REPO_ROOT = path.resolve(process.cwd(), '../..');

function read(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');
}

describe('toolchain pinning', () => {
  it('.node-version pins Node 22', () => {
    expect(read('.node-version').trim()).toBe('22');
  });

  it('root engines.node is bounded to the 22 major', () => {
    const pkg = JSON.parse(read('package.json')) as {
      engines?: { node?: string };
    };
    expect(pkg.engines?.node).toBe('22.x');
  });

  it('Dockerfile.server base image matches the pinned Node major', () => {
    expect(read('Dockerfile.server')).toContain('FROM node:22-slim');
  });
});
