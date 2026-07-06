/** discover_destinations tool: rank curated destinations by travel criteria. */
import { z } from 'zod';

import { priceLevelSchema } from 'app/schemas/priceLevel.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';

const MAX_DISCOVERY_LIMIT = 10;

export const discoverDestinationsSchema = z.object({
  climate: z
    .enum(['warm', 'mild', 'cold'])
    .optional()
    .describe('Desired climate for the trip month.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_DISCOVERY_LIMIT)
    .optional()
    .describe('Maximum destinations to return (default 5).'),
  max_daily_budget_usd: z
    .number()
    .positive()
    .optional()
    .describe('Upper bound on the budget daily spend in USD.'),
  max_price_level: priceLevelSchema
    .optional()
    .describe('Upper bound on cost tier: 1 cheapest, 4 priciest.'),
  month: z
    .string()
    .optional()
    .describe('Travel month, e.g. February; sets the climate reference.'),
  vibes: z
    .array(
      z.enum([
        'adventure',
        'beach',
        'budget',
        'city',
        'culture',
        'family',
        'food-wine',
        'romantic',
      ]),
    )
    .optional()
    .describe('Trip vibes to prefer when ranking.'),
});

export const discoverDestinationsTool: ToolModule = {
  description:
    'Suggest candidate destinations for a user who has not chosen where to go, ranked from the curated catalog by climate, budget, travel month, and vibe. Use this in the discovery phase to answer open-ended questions like "somewhere warm and cheap in February". Returns destination cards; do not restate their contents. Budgets are curated per-day estimates, not live prices.',
  name: 'discover_destinations',
  schema: discoverDestinationsSchema,
};
