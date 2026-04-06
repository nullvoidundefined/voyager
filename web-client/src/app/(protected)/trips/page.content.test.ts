import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Content-level guard for the trips list page.
 *
 * Asserts that the trip delete button calls a confirmation
 * mechanism before firing the delete mutation, rather than
 * deleting on a single click.
 */

const tripsPagePath = resolve(__dirname, 'page.tsx');
const tripsPageSource = readFileSync(tripsPagePath, 'utf-8');

describe('trips page content', () => {
  it('delete button does NOT call deleteMutation.mutate directly on click', () => {
    // The pre-audit anti-pattern was:
    //   onClick={(e) => { e.preventDefault(); deleteMutation.mutate(trip.id); }}
    // That one-liner is the failure mode. Any real confirmation
    // step must route through a handler or a confirmation check
    // before the mutation fires.
    const badPattern = /deleteMutation\.mutate\(trip\.id\);[\s\n]+\}\}\s*>/;
    expect(tripsPageSource).not.toMatch(badPattern);
  });

  it('trips page references a confirmation check before delete', () => {
    // Accept any of: window.confirm, a state-based guard (showDeleteConfirm),
    // or a Radix AlertDialog wrapper.
    const hasConfirm =
      /window\.confirm|showDeleteConfirm|AlertDialog|handleDeleteClick/.test(
        tripsPageSource,
      );
    expect(hasConfirm).toBe(true);
  });
});
