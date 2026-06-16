/** add_leg tool: append a city segment to a multi-city itinerary. */
import { z } from 'zod';

import {
  dateString,
  locationAllowlist,
} from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const addLegSchema = z.object({
  origin: locationAllowlist.describe('Origin city or airport code'),
  destination: locationAllowlist.describe('Destination city or airport code'),
  depart_date: dateString.describe('Departure date in YYYY-MM-DD format'),
  leg_order: z
    .number()
    .int()
    .positive()
    .describe('Position of this leg in the itinerary (1-indexed)'),
});

export const addLegTool: ToolModule = {
  description:
    'Add a leg to a multi-city trip. Call this when the user adds a new city segment to their itinerary.',
  name: 'add_leg',
  schema: addLegSchema,
};
