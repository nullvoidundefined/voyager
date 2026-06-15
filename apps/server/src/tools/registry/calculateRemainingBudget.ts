/** calculate_remaining_budget tool: remaining trip budget after selections. */
import type { ToolModule } from 'app/tools/registry/toolModule.js';
import { z } from 'zod';

export const calculateBudgetSchema = z.object({
  total_budget: z.number().describe('Total trip budget in USD'),
  flight_cost: z
    .number()
    .describe('Total cost of selected flights (0 if none selected yet)'),
  hotel_total_cost: z
    .number()
    .describe('Total hotel cost for entire stay (0 if none selected yet)'),
  car_rental_cost: z
    .number()
    .nonnegative()
    .describe('Total car rental cost for the trip (0 if none selected yet)'),
  experience_costs: z
    .array(z.number())
    .describe(
      'Array of individual experience costs (empty array if none selected yet)',
    ),
});

export const calculateRemainingBudgetTool: ToolModule = {
  description:
    'Calculate how much budget remains after flights, hotels, and experiences. Always use this tool instead of doing math yourself. Call it after selecting each major booking category.',
  name: 'calculate_remaining_budget',
  schema: calculateBudgetSchema,
};
