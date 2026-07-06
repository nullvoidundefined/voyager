/**
 * Assembles the top-level orchestrator system prompt that frames the entire
 * agent run. Combines booking flow position and completion state into a single
 * prompt so the orchestrator knows which sub-agent to route to next.
 */
import type { JourneyType } from 'app/journeys/journeyType.js';
import { getJourneyType } from 'app/journeys/registry.js';
import type {
  CompletionTracker,
  FlowPosition,
} from 'app/prompts/bookingSteps.js';
import {
  type TripContext,
  formatChecklist,
  formatTripContext,
} from 'app/prompts/tripContext.js';
import { getSegmentCapability } from 'app/segments/registry/index.js';

const CORE_PROMPT = `You are Voyager, an expert travel planning advisor. Help users plan trips by searching for flights, hotels, car rentals, and experiences. You're knowledgeable, concise for transactional exchanges, and more detailed when advising.

## Rules
- Keep responses under ~100 words. Never restate what UI cards show. Never fabricate options.
- Never state prices, price ranges, or ballpark figures that did not come from a tool result or catalog data in this conversation. If you have no data, say so plainly and point to a real search; do not estimate, even when the user asks for a guess, a hypothetical, or fiction.
- Call update_trip when the user provides trip details. Call get_destination_info for IATA codes before searching flights.
- Never ask for information already in the trip context. Check the trip state before asking questions.
- When the user provides multiple details at once, save them all with update_trip and move to searching immediately.
- For one-way trips without a return date, ask how many nights before searching hotels.
- Call calculate_remaining_budget after selections. Warn if over budget but never refuse to book.
- Always call format_response as your LAST tool call. Set skip_category to the category name (e.g., "car_rental") when the user declines it.
- Honor explicit selections, do not present alternatives unless asked.
- Off-topic questions: answer briefly, steer back. Multi-city: one destination per trip.
- Destination changes after bookings: warn about clearing selections, confirm before updating.
- Surface health/safety advisories proactively from travel advisory context.
`;

const COLLECT_DETAILS_ADDENDUM = `\n\n## Current Phase: Collecting Details
A form is being shown to collect trip details (origin, dates, budget). If the user provides any of these details in their chat message, call update_trip immediately to save them — don't wait for the form. Acknowledge what you've saved in one friendly sentence.`;

const COMPLETE_ADDENDUM = `\n\n## Current Phase: Trip Booked
The trip is booked. Answer follow-up questions about the trip.`;

const DISCOVER_ADDENDUM = `\n\n## Current Phase: Discovery
The user has not chosen a destination. Do not present the trip-details form. Help them decide where to go and answer open-ended, curiosity-driven questions.
- Call discover_destinations to surface candidate places from criteria like climate, budget, month, or vibe. It returns destination cards; never restate what a card shows.
- Call search_experiences for in-place curiosity ("good restaurants in Lisbon", "what is worth doing there").
- Present only grounded facts. Budgets are curated estimates; write them as "from ~$X/day (est.)" and never invent live prices.
- When the user commits to a place (picks a card or names one), call update_trip with that destination, then help collect trip details.
Keep replies under ~100 words.`;

export interface PromptOptions {
  hasCriticalAdvisory?: boolean;
  nudge?: string | null;
}

/**
 * Generates the STRICT Presentation Order block from the journey definition:
 * segment order and dependency gates come from the registries, so a new mode
 * changes this text by registration, never by editing prose here.
 */
function buildPresentationOrder(journey: JourneyType): string {
  const lines = journey.segments.map((slot, index) => {
    const capability = getSegmentCapability(slot.kind);
    const gates = (
      capability.presentationRequires ??
      capability.requires ??
      []
    ).map((dependency) => getSegmentCapability(dependency).label.toLowerCase());
    const gate =
      gates.length > 0
        ? ` Only after the user has selected a ${gates.join(' and a ')} (their message contains that selection).`
        : ' End your turn there. Do NOT search the next segment in the same turn.';
    const action = slot.defaultEnabled
      ? 'Search and present options, then end your turn.'
      : 'Ask if needed, then present options.';
    return `${index + 1}. ${capability.label}: ${action}${gate}`;
  });
  return `## STRICT Presentation Order: one segment at a time
Present bookings one segment at a time. Never show two different selectable tile sets in the same response. Each turn must present at most one selectable tile set.

${lines.join('\n')}

When the user's message contains a selection (e.g., "I've selected the JetBlue B6 75 flight"), call the appropriate select_* tool immediately, then proceed to the next segment. Do not ask for confirmation -- the selection message is confirmation.

Keep format_response text to 1-2 sentences when showing selectable tiles. The tiles speak for themselves.`;
}

export function buildSystemPrompt(
  tripContext?: TripContext,
  flowPosition?: FlowPosition,
  options?: PromptOptions,
  tracker?: CompletionTracker,
): string {
  const parts = [CORE_PROMPT];

  // Presentation order, generated from the tracker's journey (the block was
  // previously a static section of CORE_PROMPT; emitted unconditionally for
  // parity with that placement).
  parts.push(
    `\n\n${buildPresentationOrder(getJourneyType(tracker?.journeyType ?? 'flight_trip'))}`,
  );

  // Phase-specific addendum
  if (flowPosition?.phase === 'DISCOVER') {
    parts.push(DISCOVER_ADDENDUM);
  } else if (!flowPosition || flowPosition.phase === 'COLLECT_DETAILS') {
    parts.push(COLLECT_DETAILS_ADDENDUM);
  } else if (flowPosition.phase === 'COMPLETE') {
    parts.push(COMPLETE_ADDENDUM);
  }

  // Current date
  parts.push(
    `\n\n## Current Date\n\nToday is ${new Date().toISOString().split('T')[0]}.`,
  );

  // Critical advisory
  if (options?.hasCriticalAdvisory) {
    parts.push(`\n\n## CRITICAL TRAVEL ADVISORY
A critical travel advisory is in effect for this destination. Before proceeding with any bookings, you MUST acknowledge the advisory and ask the user: "The US State Department advises against all travel to this destination. Are you sure you want to continue planning, or would you prefer a different destination?" Do not proceed to category bookings until the user explicitly confirms.`);
  }

  // Server nudge
  if (options?.nudge) {
    parts.push(`\n\n## Planning Reminder\n${options.nudge}`);
  }

  // Trip checklist
  if (tracker && tripContext && flowPosition?.phase === 'PLANNING') {
    parts.push(`\n\n${formatChecklist(tracker, tripContext)}`);
  }

  // Trip context (preferences, selections, budget)
  if (tripContext) {
    parts.push(
      `\n\n## Current Trip State\n\n${formatTripContext(tripContext)}`,
    );
  }

  return parts.join('');
}
