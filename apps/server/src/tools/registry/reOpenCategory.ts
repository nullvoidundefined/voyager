/** re_open_category tool: re-open a previously skipped booking category. */
import { z } from 'zod';

import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const reOpenCategorySchema = z.object({
  category: z
    .enum(['flights', 'hotels', 'car_rental', 'experiences'])
    .describe('The booking category to re-open'),
});

export const reOpenCategoryTool: ToolModule = {
  description:
    "Re-open a booking category that was previously skipped or marked not_applicable. Use when the user changes their mind (e.g., 'actually I do need a hotel'). The system will re-route to the appropriate agent on the next turn.",
  name: 're_open_category',
  schema: reOpenCategorySchema,
};
