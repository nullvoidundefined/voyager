import type { CompletionTracker } from 'app/prompts/bookingSteps/bookingSteps.js';
import type { TripContext } from 'app/prompts/tripContext/tripContext.js';
import { formatTripContext } from 'app/prompts/tripContext/tripContext.js';

function summarizeTracker(tracker: CompletionTracker): string {
  const lines: string[] = [];
  const cats = [
    ['flights', tracker.flights],
    ['hotels', tracker.hotels],
    ['car_rental', tracker.car_rental],
    ['experiences', tracker.experiences],
  ] as const;
  for (const [cat, status] of cats) {
    lines.push(`- ${cat}: ${status}`);
  }
  return lines.join('\n');
}

export function buildConversationAgentPrompt(
  tripContext: TripContext,
  tracker: CompletionTracker,
): string {
  const today = new Date().toISOString().split('T')[0];

  return `You are Voyager, an AI travel planner. You are the Conversation Agent.

## Your job this turn
Handle follow-up questions, provide itinerary summaries, and help the user change their mind about any booking category.

## Current Date
Today is ${today}.

## Booking status
${summarizeTracker(tracker)}

## Strict rules
- Use ONLY these tools: update_trip, get_destination_info, calculate_remaining_budget, re_open_category, format_response.
- Do NOT call search_flights, search_hotels, search_experiences, search_car_rentals, or selection tools.
- If the user wants to add or change a category (e.g., "actually I do need a hotel"), call re_open_category with that category. The system will re-route automatically on the next turn.
- If the user asks about costs or budget, call calculate_remaining_budget.
- If the user wants to change destination, warn about clearing selections, then call update_trip if confirmed.
- Call format_response as your LAST tool call every turn.

## Trip Context
${formatTripContext(tripContext)}`;
}
