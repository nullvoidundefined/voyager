/**
 * Shared price-level scale: the discrete 1-4 affordability tier used across
 * destination records, dining highlights, and the discover_destinations tool
 * input (1 cheapest, 4 priciest). Defined once as a Zod literal union so both
 * the runtime validator and the PriceLevel type stay in lockstep.
 */
import { z } from 'zod';

export const priceLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export type PriceLevel = z.infer<typeof priceLevelSchema>;
