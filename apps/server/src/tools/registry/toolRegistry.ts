/**
 * The tool registry: the single ordered list of every agent tool. Both the
 * model-facing definitions (definitions.ts) and the validation lookup
 * (schemas.ts) derive from this array, so it is the one place a tool is added.
 * Kept separate from both consumers so neither imports the other (tests that
 * mock definitions.ts must not break schema derivation). Array order is the
 * order tools are presented to the model.
 */
import { addLegTool } from 'app/tools/registry/addLeg.js';
import { calculateRemainingBudgetTool } from 'app/tools/registry/calculateRemainingBudget.js';
import { discoverDestinationsTool } from 'app/tools/registry/discoverDestinations.js';
import { formatResponseTool } from 'app/tools/registry/formatResponse.js';
import { getDestinationInfoTool } from 'app/tools/registry/getDestinationInfo.js';
import { planDailyScheduleTool } from 'app/tools/registry/planDailySchedule.js';
import { reOpenCategoryTool } from 'app/tools/registry/reOpenCategory.js';
import { removeLegTool } from 'app/tools/registry/removeLeg.js';
import { reorderLegsTool } from 'app/tools/registry/reorderLegs.js';
import { searchCarRentalsTool } from 'app/tools/registry/searchCarRentals.js';
import { searchExperiencesTool } from 'app/tools/registry/searchExperiences.js';
import { searchFlightsTool } from 'app/tools/registry/searchFlights.js';
import { searchHotelsTool } from 'app/tools/registry/searchHotels.js';
import { selectCarRentalTool } from 'app/tools/registry/selectCarRental.js';
import { selectExperienceTool } from 'app/tools/registry/selectExperience.js';
import { selectFlightTool } from 'app/tools/registry/selectFlight.js';
import { selectHotelTool } from 'app/tools/registry/selectHotel.js';
import type { ToolModule } from 'app/tools/registry/toolModule.js';
import { updateTripTool } from 'app/tools/registry/updateTrip.js';

export const TOOL_REGISTRY: ToolModule[] = [
  searchFlightsTool,
  searchHotelsTool,
  searchExperiencesTool,
  discoverDestinationsTool,
  calculateRemainingBudgetTool,
  updateTripTool,
  getDestinationInfoTool,
  searchCarRentalsTool,
  selectFlightTool,
  selectHotelTool,
  selectCarRentalTool,
  selectExperienceTool,
  planDailyScheduleTool,
  addLegTool,
  removeLegTool,
  reorderLegsTool,
  reOpenCategoryTool,
  formatResponseTool,
];
