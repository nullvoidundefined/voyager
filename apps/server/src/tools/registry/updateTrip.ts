/** update_trip tool: persist destination, dates, party size, and budget. */
import {
  dateString,
  locationAllowlist,
} from 'app/tools/registry/primitives.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';
import { z } from 'zod';

export const updateTripSchema = z.object({
  destination: locationAllowlist
    .optional()
    .describe('Trip destination city name (e.g., Barcelona, Tokyo)'),
  origin: locationAllowlist
    .optional()
    .describe('Trip origin city name (optional)'),
  departure_date: dateString
    .optional()
    .describe('Departure date in YYYY-MM-DD format (optional)'),
  return_date: dateString
    .optional()
    .describe('Return date in YYYY-MM-DD format (optional)'),
  budget_total: z
    .number()
    .positive()
    .optional()
    .describe('Total trip budget in USD (optional)'),
  travelers: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Number of travelers. Set as soon as the user mentions a party size ("for two people", "solo trip", "family of four").',
    ),
  transport_mode: z
    .enum(['flying', 'driving'])
    .optional()
    .describe(
      'How the user is getting to their destination. Set when the user says they will fly or drive.',
    ),
});

export const updateTripTool: ToolModule = {
  description:
    "Update the current trip's destination, dates, traveler count, and/or budget. Call this as soon as the user's destination, travel dates, traveler count, or budget are determined from the conversation. This persists the information so the trip card shows real details instead of placeholders.",
  name: 'update_trip',
  schema: updateTripSchema,
};
