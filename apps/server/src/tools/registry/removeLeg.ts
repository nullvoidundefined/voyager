/** remove_leg tool: drop a leg from a multi-city trip by its ID. */
import { z } from 'zod';

import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const removeLegSchema = z.object({
  leg_id: z.string().min(1).describe('UUID of the leg to remove'),
});

export const removeLegTool: ToolModule = {
  description: 'Remove a leg from a multi-city trip by its ID.',
  name: 'remove_leg',
  schema: removeLegSchema,
};
