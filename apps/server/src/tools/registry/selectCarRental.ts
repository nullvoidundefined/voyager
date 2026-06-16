/** select_car_rental tool: persist the user's chosen rental car to the trip. */
import { z } from 'zod';

import { locationAllowlist } from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const selectCarRentalSchema = z.object({
  provider: locationAllowlist,
  car_name: locationAllowlist,
  car_type: z.string().optional(),
  price_per_day: z.coerce.number().optional(),
  total_price: z.coerce.number(),
  currency: z.string().min(1),
});

export const selectCarRentalTool: ToolModule = {
  description: "Persist the user's selected car rental to the trip.",
  name: 'select_car_rental',
  schema: selectCarRentalSchema,
};
