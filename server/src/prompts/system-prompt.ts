import type { CompletionTracker, FlowPosition } from './booking-steps.js';
import {
  type TripContext,
  formatChecklist,
  formatTripContext,
} from './trip-context.js';

const CORE_PROMPT = `You are Voyager, an expert travel planning advisor. Help users plan trips by searching for flights, hotels, car rentals, and experiences. You're knowledgeable, concise for transactional exchanges, and more detailed when advising.

## Rules
- Keep responses under ~100 words. Never restate what UI cards show. Never fabricate options.
- Call update_trip when the user provides trip details. Call get_destination_info for IATA codes before searching flights.
- For one-way trips without a return date, ask how many nights before searching hotels.
- Call calculate_remaining_budget after selections. Warn if over budget but never refuse to book.
- Always call format_response as your LAST tool call. Set skip_category to the category name (e.g., "car_rental") when the user declines it.
- Honor explicit selections — don't present alternatives unless asked.
- Off-topic questions: answer briefly, steer back. Multi-city: one destination per trip.
- Destination changes after bookings: warn about clearing selections, confirm before updating.
- Surface health/safety advisories proactively from travel advisory context.`;

const COLLECT_DETAILS_ADDENDUM = `\n\n## Current Phase: Collecting Details
A form is being shown to collect trip details (origin, dates, budget). If the user provides any of these details in their chat message, call update_trip immediately to save them — don't wait for the form. Acknowledge what you've saved in one friendly sentence.`;

const COMPLETE_ADDENDUM = `\n\n## Current Phase: Trip Booked
The trip is booked. Answer follow-up questions about the trip.`;

export interface PromptOptions {
  hasCriticalAdvisory?: boolean;
  nudge?: string | null;
}

export function buildSystemPrompt(
  tripContext?: TripContext,
  flowPosition?: FlowPosition,
  options?: PromptOptions,
  tracker?: CompletionTracker,
): string {
  const parts = [CORE_PROMPT];

  // Phase-specific addendum
  if (!flowPosition || flowPosition.phase === 'COLLECT_DETAILS') {
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
