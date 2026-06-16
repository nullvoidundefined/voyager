/** search_hotels tool: hotel-offer search in a city. */
import { z } from 'zod';

import {
  dateString,
  locationAllowlist,
} from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const searchHotelsSchema = z.object({
  city: locationAllowlist.describe('City name (e.g., Barcelona, Paris, Tokyo)'),
  check_in: dateString.describe('Check-in date in YYYY-MM-DD format'),
  check_out: dateString.describe('Check-out date in YYYY-MM-DD format'),
  guests: z.number().int().min(1).describe('Number of guests'),
  star_rating_min: z
    .number()
    .min(1)
    .max(5)
    .optional()
    .describe('Minimum star rating 1-5 (optional)'),
  max_price_per_night: z
    .number()
    .positive()
    .optional()
    .describe('Maximum price per night in USD (optional)'),
});

export const searchHotelsTool: ToolModule = {
  description:
    'Search for hotel offers in a city. Returns up to 5 options sorted by price. Use a city name (e.g., Barcelona, Paris).',
  name: 'search_hotels',
  schema: searchHotelsSchema,
};
