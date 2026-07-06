import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const src = readFileSync(
  resolve(__dirname.replace('/__tests__/', '/'), 'MockChatBox.tsx'),
  'utf-8',
).toLowerCase();

describe('MockChatBox demo content', () => {
  it('does not reference Monterey (use Barcelona instead)', () => {
    expect(src).not.toContain('monterey');
  });
});
