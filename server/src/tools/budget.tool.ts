export interface BudgetInput {
  total_budget: number;
  flight_cost: number;
  hotel_total_cost: number;
  experience_costs: number[];
}

export interface BudgetResult {
  total_budget: number;
  total_spent: number;
  remaining: number;
  remaining_percentage: number;
  over_budget: boolean;
  warning?: string;
  breakdown: {
    flights: { amount: number; percentage: number };
    hotels: { amount: number; percentage: number };
    experiences: { amount: number; percentage: number };
  };
}

export function calculateRemainingBudget(input: BudgetInput): BudgetResult {
  const { total_budget, flight_cost, hotel_total_cost, experience_costs } = input;

  const experienceTotal = experience_costs.reduce((sum, cost) => sum + cost, 0);
  const totalSpent = flight_cost + hotel_total_cost + experienceTotal;
  const remaining = total_budget - totalSpent;
  const remainingPercentage = total_budget > 0 ? (remaining / total_budget) * 100 : 0;

  const pct = (amount: number) => (total_budget > 0 ? (amount / total_budget) * 100 : 0);

  const result: BudgetResult = {
    total_budget,
    total_spent: totalSpent,
    remaining,
    remaining_percentage: Math.round(remainingPercentage * 100) / 100,
    over_budget: remaining < 0,
    breakdown: {
      flights: { amount: flight_cost, percentage: Math.round(pct(flight_cost) * 100) / 100 },
      hotels: {
        amount: hotel_total_cost,
        percentage: Math.round(pct(hotel_total_cost) * 100) / 100,
      },
      experiences: {
        amount: experienceTotal,
        percentage: Math.round(pct(experienceTotal) * 100) / 100,
      },
    },
  };

  if (result.over_budget) {
    result.warning = `You are $${Math.abs(remaining).toFixed(2)} over budget. Consider finding cheaper options.`;
  }

  return result;
}
