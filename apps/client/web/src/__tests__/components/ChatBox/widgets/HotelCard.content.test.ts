import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const cardPath = resolve(
  __dirname.replace('/__tests__/', '/'),
  'HotelCard.tsx',
);
const cardSource = readFileSync(cardPath, 'utf-8');

describe('HotelCard accessibility', () => {
  it('has an aria-label on the button element', () => {
    expect(cardSource).toContain('aria-label');
  });

  it('aria-label includes hotel name, city, and price', () => {
    expect(cardSource).toMatch(/aria-label=.*name/);
    expect(cardSource).toMatch(/aria-label=.*city/);
    expect(cardSource).toMatch(/aria-label=.*price/i);
  });
});
