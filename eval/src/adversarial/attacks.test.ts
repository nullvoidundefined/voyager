import { describe, expect, it } from 'vitest';

import { ATTACKS } from './attacks.js';
import type { Category, Severity } from './types.js';

const CATEGORIES: Category[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEVERITIES: Severity[] = ['P0', 'P1', 'P2'];
const EXPECTED_TOTAL = 54;
const MAX_ALLOWED_TURNS = 10;
const EXPECTED_PER_CATEGORY: Record<Category, number> = {
  A: 10,
  B: 8,
  C: 7,
  D: 7,
  E: 6,
  F: 6,
  G: 6,
  H: 4,
};

describe('attack catalog', () => {
  it('contains exactly 54 attacks', () => {
    expect(ATTACKS).toHaveLength(EXPECTED_TOTAL);
  });

  it('every attack has a unique id', () => {
    const ids = ATTACKS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('id prefix matches category', () => {
    for (const a of ATTACKS) {
      expect(a.id.startsWith(`${a.category}`)).toBe(true);
    }
  });

  it('every category is present at the expected count', () => {
    const counts: Record<Category, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 0,
      G: 0,
      H: 0,
    };
    for (const a of ATTACKS) counts[a.category] += 1;
    expect(counts).toEqual(EXPECTED_PER_CATEGORY);
  });

  it('every attack has a non-empty opening_message and antagonist_goal', () => {
    for (const a of ATTACKS) {
      expect(a.opening_message.length).toBeGreaterThan(0);
      expect(a.antagonist_goal.length).toBeGreaterThan(0);
    }
  });

  it('every attack has at least one must_not entry', () => {
    for (const a of ATTACKS) {
      expect(a.must_not.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('max_turns is between 1 and 10', () => {
    for (const a of ATTACKS) {
      expect(a.max_turns).toBeGreaterThanOrEqual(1);
      expect(a.max_turns).toBeLessThanOrEqual(MAX_ALLOWED_TURNS);
    }
  });

  it('severity is one of P0|P1|P2', () => {
    for (const a of ATTACKS) {
      expect(SEVERITIES).toContain(a.severity);
    }
  });

  it('expected_behavior.type is one of the four shapes', () => {
    const allowed = ['refuse', 'clarify', 'redirect', 'flag_dangerous'];
    for (const a of ATTACKS) {
      expect(allowed).toContain(a.expected_behavior.type);
    }
  });

  it('clarify attacks have must_ask_about field', () => {
    for (const a of ATTACKS) {
      if (a.expected_behavior.type === 'clarify') {
        expect(a.expected_behavior.must_ask_about.length).toBeGreaterThan(0);
      }
    }
  });
});
