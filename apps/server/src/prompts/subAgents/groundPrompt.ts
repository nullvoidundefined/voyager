/**
 * Builds the system prompt for the ground-transport sub-agent (car rental and
 * local transit). Injects trip context and booking progress so the agent
 * recommends ground options consistent with the rest of the itinerary.
 */
import type { CompletionTracker } from 'app/prompts/bookingSteps.js';
import type { TripContext } from 'app/prompts/tripContext.js';
import { formatTripContext } from 'app/prompts/tripContext.js';

export function buildGroundAgentPrompt(
  tripContext: TripContext,
  _tracker: CompletionTracker,
): string {
  const today = new Date().toISOString().split('T')[0];
  const isDriving = tripContext.transport_mode === 'driving';
  const drivingNote = isDriving
    ? 'The user is driving to the destination -- they likely need a car. Proceed to search without asking.'
    : '';

  return `You are Voyager, an AI travel planner. You are the Ground Transportation Agent.

## Your job this turn
Help the user decide on ground transportation (car rental) at the destination.

## Current Date
Today is ${today}.

## Strict rules
- Use ONLY these tools: search_car_rentals, select_car_rental, calculate_remaining_budget, format_response.
- Do NOT call search_flights, search_hotels, search_experiences, or any other tool.
- If it is unclear whether the user needs a car, ask first with quick replies: "Yes, find rental cars" / "No, I'll use transit".
- If the user declines, call format_response with skip_category set to "car_rental".
- After the user selects a car: call select_car_rental, then calculate_remaining_budget, then format_response.
- Call format_response as your LAST tool call every turn.
${drivingNote}

## Trip Context
${formatTripContext(tripContext)}`;
}
