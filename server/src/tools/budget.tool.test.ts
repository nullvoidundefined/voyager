import { describe, expect, it } from "vitest";

import { calculateRemainingBudget } from "app/tools/budget.tool.js";

describe("budget.tool", () => {
  describe("calculateRemainingBudget", () => {
    it("calculates remaining budget with all categories", () => {
      const result = calculateRemainingBudget({
        total_budget: 3000,
        flight_cost: 900,
        hotel_total_cost: 1200,
        experience_costs: [50, 75, 100],
      });

      expect(result.remaining).toBe(675);
      expect(result.total_spent).toBe(2325);
      expect(result.over_budget).toBe(false);
      expect(result.breakdown.flights.amount).toBe(900);
      expect(result.breakdown.hotels.amount).toBe(1200);
      expect(result.breakdown.experiences.amount).toBe(225);
    });

    it("returns correct percentages", () => {
      const result = calculateRemainingBudget({
        total_budget: 1000,
        flight_cost: 500,
        hotel_total_cost: 300,
        experience_costs: [100],
      });

      expect(result.breakdown.flights.percentage).toBe(50);
      expect(result.breakdown.hotels.percentage).toBe(30);
      expect(result.breakdown.experiences.percentage).toBe(10);
      expect(result.remaining_percentage).toBe(10);
    });

    it("flags over-budget scenarios", () => {
      const result = calculateRemainingBudget({
        total_budget: 1000,
        flight_cost: 600,
        hotel_total_cost: 500,
        experience_costs: [100],
      });

      expect(result.remaining).toBe(-200);
      expect(result.over_budget).toBe(true);
      expect(result.warning).toContain("over budget");
    });

    it("handles zero experience costs", () => {
      const result = calculateRemainingBudget({
        total_budget: 2000,
        flight_cost: 500,
        hotel_total_cost: 800,
        experience_costs: [],
      });

      expect(result.remaining).toBe(700);
      expect(result.breakdown.experiences.amount).toBe(0);
      expect(result.breakdown.experiences.percentage).toBe(0);
    });

    it("handles zero costs (beginning of planning)", () => {
      const result = calculateRemainingBudget({
        total_budget: 3000,
        flight_cost: 0,
        hotel_total_cost: 0,
        experience_costs: [],
      });

      expect(result.remaining).toBe(3000);
      expect(result.total_spent).toBe(0);
      expect(result.remaining_percentage).toBe(100);
    });

    it("rounds amounts to 2 decimal places", () => {
      const result = calculateRemainingBudget({
        total_budget: 1000,
        flight_cost: 333.333,
        hotel_total_cost: 333.333,
        experience_costs: [333.333],
      });

      expect(result.total_spent).toBeCloseTo(999.999, 2);
      expect(result.remaining).toBeCloseTo(0.001, 2);
    });
  });
});
