import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The web service ships as a Docker image that runs `node server.js` from
// Next.js's standalone output (see Dockerfile.web). Without `output: 'standalone'`
// the build produces no self-contained server, the image falls back to
// `next start` (which needs dev dependencies absent in production), and the
// container crash-loops. This guards that build contract so the web service
// cannot silently regress to a non-runnable image.
describe('next.config standalone build contract', () => {
  it('enables Next.js standalone output for the production Docker image', () => {
    const configPath = path.resolve(process.cwd(), 'next.config.ts');
    const source = readFileSync(configPath, 'utf8');
    expect(source).toMatch(/output:\s*['"]standalone['"]/);
  });
});
