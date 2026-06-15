/** search_flights tool: flight-offer search between two airports. */
import {
  dateString,
  locationAllowlist,
} from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';
import { z } from 'zod';

export const searchFlightsSchema = z.object({
  origin: locationAllowlist.describe('Origin IATA airport code (e.g., SFO)'),
  destination: locationAllowlist.describe(
    'Destination IATA airport code (e.g., BCN)',
  ),
  departure_date: dateString.describe('Departure date in YYYY-MM-DD format'),
  return_date: dateString
    .optional()
    .describe('Return date in YYYY-MM-DD format (optional for one-way)'),
  passengers: z.number().int().min(1).describe('Number of adult passengers'),
  max_price: z
    .number()
    .positive()
    .optional()
    .describe('Maximum price per person in USD (optional)'),
  cabin_class: z
    .enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'])
    .optional()
    .describe(
      'Cabin class: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST (optional)',
    ),
  one_way: z
    .boolean()
    .optional()
    .describe(
      'Set to true for one-way flights (omits return date). Default: false.',
    ),
  flexible_dates: z
    .boolean()
    .optional()
    .describe(
      'Set to true to also search dates near the requested departure for cheaper options. Default: false.',
    ),
});

export const searchFlightsTool: ToolModule = {
  description:
    'Search for flight offers between two airports. Returns up to 5 options sorted by price. Use IATA airport codes (e.g., SFO, BCN, JFK). If you only have a city name, call get_destination_info first to resolve the IATA code.',
  name: 'search_flights',
  schema: searchFlightsSchema,
};
