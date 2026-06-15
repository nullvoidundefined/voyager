/** select_hotel tool: persist the user's chosen hotel to the trip. */
import { locationAllowlist } from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';
import { z } from 'zod';

export const selectHotelSchema = z.object({
  name: locationAllowlist,
  city: locationAllowlist.optional(),
  star_rating: z.coerce.number().optional(),
  price_per_night: z.coerce.number(),
  total_price: z.coerce.number(),
  currency: z.string().min(1),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
});

export const selectHotelTool: ToolModule = {
  description:
    "Persist the user's selected hotel to the trip. Call this when the user confirms a hotel choice.",
  name: 'select_hotel',
  schema: selectHotelSchema,
};
