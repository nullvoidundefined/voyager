/** select_flight tool: persist the user's chosen flight to the trip. */
import { locationAllowlist } from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';
import { z } from 'zod';

export const selectFlightSchema = z.object({
  airline: locationAllowlist,
  flight_number: locationAllowlist,
  origin: locationAllowlist,
  destination: locationAllowlist,
  departure_time: z.string().optional(),
  arrival_time: z.string().optional(),
  price: z.coerce.number(),
  currency: z.string().min(1),
});

export const selectFlightTool: ToolModule = {
  description:
    "Persist the user's selected flight to the trip. Call this when the user confirms a flight choice.",
  name: 'select_flight',
  schema: selectFlightSchema,
};
