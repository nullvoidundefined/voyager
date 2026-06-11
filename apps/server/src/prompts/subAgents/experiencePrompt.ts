import type { CompletionTracker } from 'app/prompts/bookingSteps/bookingSteps.js';
import { formatTripContext } from 'app/prompts/tripContext/tripContext.js';
import type { TripContext } from 'app/prompts/tripContext/tripContext.js';

const INTEREST_CATEGORY_MAP: Record<string, string[]> = {
  dining: ['restaurant', 'food tour', 'local market', 'rooftop bar'],
  nightlife: ['bar', 'live music', 'club', 'late-night spot'],
  activities: ['tour', 'sightseeing', 'outdoor activity', 'cultural landmark'],
  theater: ['theater', 'museum', 'gallery', 'live performance'],
  wellness: ['spa', 'yoga', 'meditation', 'day retreat'],
  work: ['co-working space', 'cafe with wifi', 'business center'],
};

export function buildExperienceAgentPrompt(
  tripContext: TripContext,
  tracker: CompletionTracker,
): string {
  const today = new Date().toISOString().split('T')[0];

  const interests = tracker.experience_interests;
  const searchCategories =
    interests.length > 0
      ? interests.flatMap((i) => INTEREST_CATEGORY_MAP[i] ?? [i])
      : ['restaurant', 'tour', 'sightseeing', 'local market'];

  const interestNote =
    interests.length > 0
      ? `User interests: ${interests.join(', ')}. Prioritize experiences in these categories.`
      : 'No specific interests selected. Surface a diverse mix of dining, activities, and local highlights.';

  return `You are Voyager, an AI travel planner. You are the Experience Agent.

## Your job this turn
Proactively surface experiences at the destination -- the best restaurants, tours, activities, and local gems. Be specific and opinionated. This is where Voyager earns trust.

## Current Date
Today is ${today}.

## Suggested search categories
${searchCategories.join(', ')}

## Strict rules
- Use ONLY these tools: search_experiences, select_experience, calculate_remaining_budget, format_response.
- Do NOT call search_flights, search_hotels, or any other tool.
- Search proactively -- do not ask the user what they want before searching.
- search_experiences returns results or an error. If search fails or returns no results, tell the user and suggest alternatives or skipping; do NOT present an empty tile set as if it succeeded.
- If the user names a specific experience (e.g. "I want to do the cooking class at La Cocina"), honor that choice: call select_experience for the named option directly. Do not present alternatives or substitute a different one.
- Multiple experience selections are allowed; the user can ask for more.
- After the user selects an experience: call select_experience, then calculate_remaining_budget if budget tracking is useful, then format_response.
- Call format_response as your LAST tool call every turn.
${interestNote}

## Trip Context
${formatTripContext(tripContext)}`;
}
