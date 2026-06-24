import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readDeployedCommit } from 'app/config/deployedCommit.js';

const SHA = '611902175a2e5c445a6d5f97fbadab93fa9878a2';

let dir: string;
let versionFile: string;
const originalEnv = process.env.RAILWAY_GIT_COMMIT_SHA;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'deployed-commit-'));
  versionFile = path.join(dir, 'version.json');
  delete process.env.RAILWAY_GIT_COMMIT_SHA;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (originalEnv === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
  else process.env.RAILWAY_GIT_COMMIT_SHA = originalEnv;
});

describe('readDeployedCommit', () => {
  it('prefers RAILWAY_GIT_COMMIT_SHA over the version file', () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = SHA;
    writeFileSync(versionFile, JSON.stringify({ commit: 'stale-from-file' }));
    expect(readDeployedCommit(versionFile)).toBe(SHA);
  });

  it('falls back to the version file when the env var is unset', () => {
    writeFileSync(versionFile, JSON.stringify({ commit: SHA }));
    expect(readDeployedCommit(versionFile)).toBe(SHA);
  });

  it('returns unknown when neither the env var nor the file is available', () => {
    expect(readDeployedCommit(path.join(dir, 'missing.json'))).toBe('unknown');
  });

  it('returns unknown when the file has no commit field', () => {
    writeFileSync(versionFile, JSON.stringify({}));
    expect(readDeployedCommit(versionFile)).toBe('unknown');
  });

  it('ignores a blank env var and uses the file', () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = '   ';
    writeFileSync(versionFile, JSON.stringify({ commit: SHA }));
    expect(readDeployedCommit(versionFile)).toBe(SHA);
  });
});
