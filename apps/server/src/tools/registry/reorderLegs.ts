/** reorder_legs tool: re-sequence the legs of a multi-city trip. */
import { z } from 'zod';

import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const reorderLegsSchema = z.object({
  ordered_leg_ids: z
    .array(z.string().min(1))
    .min(1)
    .describe('Leg UUIDs in the desired display order'),
});

export const reorderLegsTool: ToolModule = {
  description:
    'Reorder the legs of a multi-city trip by providing the desired leg ID sequence.',
  name: 'reorder_legs',
  schema: reorderLegsSchema,
};
