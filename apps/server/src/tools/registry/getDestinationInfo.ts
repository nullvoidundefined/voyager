/** get_destination_info tool: resolve a city to IATA code and travel facts. */
import { z } from 'zod';

import { locationAllowlist } from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const getDestinationInfoSchema = z.object({
  city_name: locationAllowlist.describe(
    'City name (e.g., Barcelona, San Francisco, Tokyo)',
  ),
});

export const getDestinationInfoTool: ToolModule = {
  description:
    'Look up IATA airport code, country, timezone, currency, and best time to visit for a city. Use this to resolve city names to IATA codes before calling search_flights or search_hotels. Returns alternate_iata_codes for multi-airport cities (e.g., NYC has JFK plus EWR and LGA); mention alternates to the user when they may yield different prices or routes.',
  name: 'get_destination_info',
  schema: getDestinationInfoSchema,
};
