import { describe, expect, it } from 'vitest';

import { planCardSchema } from '../planCard.js';

const validCategory = {
  id: 'flights',
  label: 'Flights',
  enabled: true,
  not_applicable: false,
};

describe('planCardSchema', () => {
  it('accepts a minimal valid card with at least one category', () => {
    const result = planCardSchema.safeParse({ categories: [validCategory] });
    expect(result.success).toBe(true);
  });

  it('rejects a card with zero categories', () => {
    const result = planCardSchema.safeParse({ categories: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a card with more than 10 categories (SEC-04 cap)', () => {
    const result = planCardSchema.safeParse({
      categories: Array.from({ length: 11 }, () => validCategory),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown category id (only the canonical 4 allowed)', () => {
    const result = planCardSchema.safeParse({
      categories: [{ ...validCategory, id: 'gambling' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 3 sub_options per category', () => {
    const subOption = {
      type: 'multi' as const,
      id: 'interests',
      label: 'Interests',
      options: [],
      values: [],
    };
    const result = planCardSchema.safeParse({
      categories: [
        {
          ...validCategory,
          sub_options: [subOption, subOption, subOption, subOption],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 20 values in a multi sub_option', () => {
    const result = planCardSchema.safeParse({
      categories: [
        {
          ...validCategory,
          sub_options: [
            {
              type: 'multi',
              id: 'interests',
              label: 'Interests',
              options: [],
              values: Array.from({ length: 21 }, (_, i) => `v${i}`),
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects per-value strings longer than 100 chars', () => {
    const result = planCardSchema.safeParse({
      categories: [
        {
          ...validCategory,
          sub_options: [
            {
              type: 'multi',
              id: 'interests',
              label: 'Interests',
              options: [],
              values: ['x'.repeat(101)],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(planCardSchema.safeParse(null).success).toBe(false);
    expect(planCardSchema.safeParse('not a card').success).toBe(false);
    expect(planCardSchema.safeParse(42).success).toBe(false);
  });

  it('rejects missing required fields on a category', () => {
    const result = planCardSchema.safeParse({
      categories: [{ id: 'flights', label: 'Flights' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a radio sub_option with a value', () => {
    const result = planCardSchema.safeParse({
      categories: [
        {
          ...validCategory,
          sub_options: [
            {
              type: 'radio',
              id: 'trip_type',
              label: 'Trip Type',
              options: [
                { id: 'round_trip', label: 'Round trip' },
                { id: 'one_way', label: 'One way' },
              ],
              value: 'round_trip',
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
