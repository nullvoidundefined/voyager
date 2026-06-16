/** select_experience tool: persist the user's chosen experience to the trip. */
import { z } from 'zod';

import { locationAllowlist } from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const selectExperienceSchema = z.object({
  name: locationAllowlist,
  category: z.string().optional(),
  estimated_cost: z.coerce.number(),
  rating: z.coerce.number().optional(),
});

export const selectExperienceTool: ToolModule = {
  description: "Persist the user's selected experience to the trip.",
  name: 'select_experience',
  schema: selectExperienceSchema,
};
