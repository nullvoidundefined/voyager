import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cardPath = resolve(__dirname, '..', 'FlightCard.tsx');
const cardSource = readFileSync(cardPath, 'utf-8');

describe('FlightCard accessibility', () => {
  it('has an aria-label on the button element', () => {
    expect(cardSource).toContain('aria-label');
  });

  it('aria-label includes airline, flight number, route, and price', () => {
    expect(cardSource).toMatch(/aria-label=.*airline/);
    expect(cardSource).toMatch(/aria-label=.*flightNumber/);
    expect(cardSource).toMatch(/aria-label=.*origin/);
    expect(cardSource).toMatch(/aria-label=.*destination/);
    expect(cardSource).toMatch(/aria-label=.*price/i);
  });
});
