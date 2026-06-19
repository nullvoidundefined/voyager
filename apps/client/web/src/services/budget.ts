/**
 * Pure budget-math helpers for the trip budget widget. Extracted from the page
 * so the over-budget bar-normalization rules are unit-testable in isolation.
 */

// Helpers for the trip budget widget. Extracted from the page so the
// over-budget rendering rules in F-03/F-14 are unit-testable in
// isolation.

export interface BudgetState {
  budgetTotal: number | null;
  allocated: number;
}

/**
 * Returns the denominator the budget bar segment widths should divide
 * by. When the trip is within budget, divides by budget_total so unused
 * capacity renders as empty space. When allocated has crossed
 * budget_total (the over-budget case), divides by allocated so each
 * segment is normalized to its share and the bar always sums to 100%
 * instead of overflowing and being clipped by `overflow: hidden`.
 *
 * Returns 1 when budget_total is missing or non-positive so callers
 * can divide safely without producing Infinity or NaN.
 */
export function budgetBarDivisor(state: BudgetState): number {
  const { budgetTotal, allocated } = state;
  if (budgetTotal == null || budgetTotal <= 0) return 1;
  return Math.max(allocated, budgetTotal);
}

export function isOverBudget(state: BudgetState): boolean {
  const { budgetTotal, allocated } = state;
  if (budgetTotal == null) return false;
  return allocated > budgetTotal;
}
