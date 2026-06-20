import { describe, expect, it } from 'vitest';

import { budgetBarDivisor, isOverBudget } from '@/services/budget';

describe('budgetBarDivisor', () => {
  it('divides by budget_total when within budget', () => {
    expect(budgetBarDivisor({ budgetTotal: 3000, allocated: 1800 })).toBe(3000);
  });

  it('divides by allocated when over budget so segments sum to 100% not >100%', () => {
    expect(budgetBarDivisor({ budgetTotal: 3000, allocated: 4500 })).toBe(4500);
  });

  it('returns 1 when budget_total is null so callers do not divide by zero', () => {
    expect(budgetBarDivisor({ budgetTotal: null, allocated: 0 })).toBe(1);
  });

  it('returns 1 when budget_total is zero so callers do not produce Infinity', () => {
    expect(budgetBarDivisor({ budgetTotal: 0, allocated: 100 })).toBe(1);
  });

  it('returns 1 when budget_total is negative', () => {
    expect(budgetBarDivisor({ budgetTotal: -100, allocated: 100 })).toBe(1);
  });
});

describe('isOverBudget', () => {
  it('is true when allocated exceeds budget_total', () => {
    expect(isOverBudget({ budgetTotal: 1000, allocated: 1500 })).toBe(true);
  });

  it('is false when allocated equals budget_total (exactly at cap)', () => {
    expect(isOverBudget({ budgetTotal: 1000, allocated: 1000 })).toBe(false);
  });

  it('is false when within budget', () => {
    expect(isOverBudget({ budgetTotal: 1000, allocated: 500 })).toBe(false);
  });

  it('is false when budget_total is null (no budget set)', () => {
    expect(isOverBudget({ budgetTotal: null, allocated: 9999 })).toBe(false);
  });
});
