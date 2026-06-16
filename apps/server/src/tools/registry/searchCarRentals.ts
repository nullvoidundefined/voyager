/** search_car_rentals tool: rental-car availability at a destination. */
import { z } from 'zod';

import {
  dateString,
  locationAllowlist,
} from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const searchCarRentalsSchema = z.object({
  pickup_location: locationAllowlist.describe(
    'City or airport for car pickup (e.g. "Tokyo" or "NRT")',
  ),
  pickup_date: dateString.describe('Pickup date in YYYY-MM-DD format'),
  dropoff_date: dateString.describe('Dropoff date in YYYY-MM-DD format'),
  dropoff_location: locationAllowlist
    .optional()
    .describe(
      'City or airport for dropoff. Defaults to pickup location if omitted.',
    ),
  car_type: z
    .string()
    .max(50)
    .optional()
    .describe(
      'Preferred car type: economy, compact, midsize, suv, luxury, van',
    ),
});

export const searchCarRentalsTool: ToolModule = {
  description:
    'Search for car rental options at a destination. Returns available cars with pricing, features, and pickup/dropoff details. If the result has empty `rentals` and an `error` field, the search did not succeed for this destination. Tell the user "no car rentals available for this destination" and offer alternatives like taxis, public transit, or arranging rental independently. Do NOT say you are "having trouble accessing" results.',
  name: 'search_car_rentals',
  schema: searchCarRentalsSchema,
};
