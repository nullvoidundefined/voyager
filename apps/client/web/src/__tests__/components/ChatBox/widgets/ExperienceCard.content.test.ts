import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const cardPath = resolve(
  __dirname.replace('/__tests__/', '/'),
  'ExperienceCard.tsx',
);
const cardSource = readFileSync(cardPath, 'utf-8');

describe('ExperienceCard accessibility', () => {
  it('has an aria-label on the button element', () => {
    expect(cardSource).toContain('aria-label');
  });

  it('aria-label includes name, category, and estimated cost', () => {
    expect(cardSource).toMatch(/aria-label=.*name/);
    expect(cardSource).toMatch(/aria-label=.*category/);
    expect(cardSource).toMatch(/aria-label=.*estimatedCost/i);
  });
});
