/**
 * Tool input schemas. The per-tool Zod schemas now live beside their definitions
 * in tools/registry/; this module re-exports them under their established names
 * (so executor imports stay stable) and derives the toolSchemas name->schema
 * lookup from the registry for validation dispatch.
 */
import { TOOL_REGISTRY } from 'app/tools/registry/toolRegistry.js';
import type { ZodType } from 'zod';

export { addLegSchema } from 'app/tools/registry/addLeg.js';
export { calculateBudgetSchema } from 'app/tools/registry/calculateRemainingBudget.js';
export { formatResponseSchema } from 'app/tools/registry/formatResponse.js';
export { getDestinationInfoSchema } from 'app/tools/registry/getDestinationInfo.js';
export { planDailyScheduleSchema } from 'app/tools/registry/planDailySchedule.js';
export { reOpenCategorySchema } from 'app/tools/registry/reOpenCategory.js';
export { removeLegSchema } from 'app/tools/registry/removeLeg.js';
export { reorderLegsSchema } from 'app/tools/registry/reorderLegs.js';
export { searchCarRentalsSchema } from 'app/tools/registry/searchCarRentals.js';
export { searchExperiencesSchema } from 'app/tools/registry/searchExperiences.js';
export { searchFlightsSchema } from 'app/tools/registry/searchFlights.js';
export { searchHotelsSchema } from 'app/tools/registry/searchHotels.js';
export { selectCarRentalSchema } from 'app/tools/registry/selectCarRental.js';
export { selectExperienceSchema } from 'app/tools/registry/selectExperience.js';
export { selectFlightSchema } from 'app/tools/registry/selectFlight.js';
export { selectHotelSchema } from 'app/tools/registry/selectHotel.js';
export { updateTripSchema } from 'app/tools/registry/updateTrip.js';

export const toolSchemas: Record<string, ZodType> = Object.fromEntries(
  TOOL_REGISTRY.map((tool) => [tool.name, tool.schema]),
);
