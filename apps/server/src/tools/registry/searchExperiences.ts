/** search_experiences tool: activities, tours, restaurants at a destination. */
import { locationAllowlist } from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';
import { z } from 'zod';

export const searchExperiencesSchema = z.object({
  location: locationAllowlist.describe(
    'City or area name (e.g., Barcelona, Paris 6th arrondissement)',
  ),
  categories: z
    .array(locationAllowlist)
    .min(1)
    .describe(
      "Activity categories to search for (e.g., ['museum', 'cooking class', 'wine tasting'])",
    ),
  max_price_per_person: z
    .number()
    .positive()
    .optional()
    .describe('Maximum estimated cost per person in USD (optional)'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of results to return (default 5)'),
});

export const searchExperiencesTool: ToolModule = {
  description:
    'Search for activities, tours, restaurants, and experiences at a destination. Uses Google Places to find highly-rated options matching the specified categories.',
  name: 'search_experiences',
  schema: searchExperiencesSchema,
};
