/**
 * Maps each segment kind to its sub-agent prompt builder. Registered here
 * rather than on the capability to keep the capability files free of prompt
 * imports; a new mode adds one entry alongside its capability registration.
 */
import type { SegmentKind } from '@repo/types';

import type { CompletionTracker } from 'app/prompts/bookingSteps.js';
import { buildExperienceAgentPrompt } from 'app/prompts/subAgents/experiencePrompt.js';
import { buildFlightAgentPrompt } from 'app/prompts/subAgents/flightPrompt.js';
import { buildGroundAgentPrompt } from 'app/prompts/subAgents/groundPrompt.js';
import { buildHotelAgentPrompt } from 'app/prompts/subAgents/hotelPrompt.js';
import type { TripContext } from 'app/prompts/tripContext.js';

type SegmentPromptBuilder = (
  tripContext: TripContext,
  tracker: CompletionTracker,
) => string;

export const SEGMENT_PROMPT_BUILDERS: Record<
  SegmentKind,
  SegmentPromptBuilder
> = {
  car_rental: buildGroundAgentPrompt,
  experience: buildExperienceAgentPrompt,
  flight: buildFlightAgentPrompt,
  hotel: buildHotelAgentPrompt,
};
