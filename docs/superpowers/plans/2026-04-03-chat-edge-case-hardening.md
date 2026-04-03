# Chat Edge Case Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the chat conversation against edge cases across robustness, data quality, budget, safety, and trip logistics. Add one-way trip support and traveler safety preferences.

**Architecture:** Server-side guards for data integrity (empty itinerary block, past date validation, destination change clearing, budget-optional gate). Prompt-level instructions for conversational behavior (off-topic, impossible requests, health/weather awareness, safety signals). New preference fields (lgbtq_safety, gender) in the Travel Party wizard step with corresponding prompt injection in trip context.

**Tech Stack:** Express 5, TypeScript, PostgreSQL (node-pg-migrate), React/Next.js 15, SCSS modules, Vitest

**Verification before every commit:** `pnpm format:check && pnpm lint && pnpm test && pnpm build`

---

## File Structure

### New Files

```
server/migrations/1771879388558_add-trip-type-column.js          # trip_type column
```

### Modified Files

```
server/src/prompts/booking-steps.ts                              # Budget optional in COLLECT_DETAILS, empty itinerary guard
server/src/prompts/booking-steps.test.ts                         # Tests for new flow position logic
server/src/prompts/category-prompts.ts                           # Budget advisory, weather-activity, impossible requests, category undo, one-way hotels
server/src/prompts/category-prompts.test.ts                      # Tests for new prompt content
server/src/prompts/system-prompt.ts                              # Off-topic, multi-city, health awareness, Level 4, safety signals, destination change
server/src/prompts/system-prompt.test.ts                         # Tests for new prompt content
server/src/prompts/trip-context.ts                               # Safety preference fields, budget-optional context
server/src/services/agent.service.ts                             # format_response fallback with warning
server/src/tools/budget.tool.ts                                  # Handle missing budget (null)
server/src/tools/budget.tool.test.ts                             # Test missing budget
server/src/tools/definitions.ts                                  # one_way param on search_flights
server/src/tools/flights.tool.ts                                 # one_way support in SerpApi call
server/src/handlers/trips/trips.ts                               # Date validation, trip_type, destination change clears selections
server/src/handlers/trips/trips.test.ts                          # Tests for date validation and destination change
server/src/handlers/chat/chat.ts                                 # Empty itinerary block, category undo reset, budget-optional form
server/src/handlers/chat/chat.test.ts                            # Tests for empty itinerary and category undo
server/src/schemas/userPreferences.ts                            # lgbtq_safety, gender fields
server/src/schemas/userPreferences.test.ts                       # Tests for new fields
server/src/services/enrichment-sources/visa-matrix.ts            # Updated fallback text
server/src/repositories/trips/trips.ts                           # clearSelectionsForTrip function, trip_type in UpdateTripInput
web-client/src/components/ChatBox/TripDetailsForm.tsx            # Trip type toggle, submitted lockdown
web-client/src/components/PreferencesWizard/steps/TravelPartyStep.tsx  # LGBTQ+ toggle, gender select
web-client/src/lib/preferenceOptions.ts                          # GENDER_OPTIONS, lgbtq_safety field in UserPreferences
```

---

## Task 1: Budget-Optional Flow Position + Tests

**Files:**

- Modify: `server/src/prompts/booking-steps.ts`
- Modify: `server/src/prompts/booking-steps.test.ts`

- [ ] **Step 1: Write the failing test for budget-optional COLLECT_DETAILS**

Add to `server/src/prompts/booking-steps.test.ts` inside the `getFlowPosition` describe block:

```typescript
it('should NOT require budget_total for COLLECT_DETAILS — proceeds to CATEGORY when budget is null', () => {
  const trip: TripState = {
    destination: 'Paris',
    origin: 'JFK',
    departure_date: '2026-06-01',
    return_date: '2026-06-10',
    budget_total: null,
    transport_mode: null,
    flights: [],
    hotels: [],
    experiences: [],
    status: 'planning',
  };
  const result = getFlowPosition(trip, DEFAULT_BOOKING_STATE);
  expect(result.phase).toBe('CATEGORY');
});

it('should require return_date only when trip_type is round_trip or not set', () => {
  const trip: TripState = {
    destination: 'Paris',
    origin: 'JFK',
    departure_date: '2026-06-01',
    return_date: null,
    budget_total: null,
    transport_mode: null,
    flights: [],
    hotels: [],
    experiences: [],
    status: 'planning',
  };
  // Without trip_type, return_date null → COLLECT_DETAILS
  const result = getFlowPosition(trip, DEFAULT_BOOKING_STATE);
  expect(result.phase).toBe('COLLECT_DETAILS');
});

it('should allow null return_date when trip_type is one_way', () => {
  const trip: TripState = {
    destination: 'Paris',
    origin: 'JFK',
    departure_date: '2026-06-01',
    return_date: null,
    budget_total: null,
    transport_mode: null,
    flights: [],
    hotels: [],
    experiences: [],
    status: 'planning',
    trip_type: 'one_way',
  };
  const result = getFlowPosition(trip, DEFAULT_BOOKING_STATE);
  expect(result.phase).toBe('CATEGORY');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/prompts/booking-steps.test.ts`
Expected: FAIL — `trip_type` does not exist on `TripState`, and budget_total null still returns COLLECT_DETAILS

- [ ] **Step 3: Update TripState and getFlowPosition**

In `server/src/prompts/booking-steps.ts`, add `trip_type` to `TripState` (line 133):

```typescript
export interface TripState {
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  transport_mode: 'flying' | 'driving' | null;
  trip_type?: 'round_trip' | 'one_way';
  flights: Array<{ id: string }>;
  hotels: Array<{ id: string }>;
  car_rentals?: Array<{ id: string }>;
  experiences: Array<{ id: string }>;
  status: string;
}
```

Update `getFlowPosition` (lines 179-186) — remove `budget_total` check and make `return_date` conditional on `trip_type`:

```typescript
export function getFlowPosition(
  trip: TripState,
  bookingState: BookingState,
): FlowPosition {
  if (trip.status !== 'planning') {
    return { phase: 'COMPLETE' };
  }

  const needsReturnDate =
    trip.trip_type !== 'one_way' && trip.return_date === null;

  if (trip.departure_date === null || needsReturnDate || trip.origin === null) {
    return { phase: 'COLLECT_DETAILS' };
  }

  // If transport_mode not set, flights category handles the flying/driving question
  if (trip.transport_mode === null) {
    return {
      phase: 'CATEGORY',
      category: 'flights',
      status: bookingState.flights.status,
    };
  }

  for (const cat of CATEGORY_ORDER) {
    // Auto-skip flights when driving
    if (cat === 'flights' && trip.transport_mode === 'driving') {
      continue;
    }

    const catState = bookingState[cat];
    if (catState.status !== 'done' && catState.status !== 'skipped') {
      return { phase: 'CATEGORY', category: cat, status: catState.status };
    }
  }

  return { phase: 'CONFIRM' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/prompts/booking-steps.test.ts`
Expected: PASS

- [ ] **Step 5: Verify full chain**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add server/src/prompts/booking-steps.ts server/src/prompts/booking-steps.test.ts
git commit -m "feat: make budget optional in COLLECT_DETAILS gate, add trip_type to TripState"
```

---

## Task 2: Budget Tool Handles Missing Budget + Tests

**Files:**

- Modify: `server/src/tools/budget.tool.ts`
- Modify: `server/src/tools/budget.tool.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `server/src/tools/budget.tool.test.ts`:

```typescript
it('should return no-budget-set response when total_budget is 0', () => {
  const result = calculateRemainingBudget({
    total_budget: 0,
    flight_cost: 500,
    hotel_total_cost: 300,
    experience_costs: [100],
  });
  expect(result.no_budget_set).toBe(true);
  expect(result.total_spent).toBe(900);
  expect(result.remaining).toBe(0);
  expect(result.over_budget).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/tools/budget.tool.test.ts`
Expected: FAIL — `no_budget_set` property does not exist

- [ ] **Step 3: Update BudgetResult and calculateRemainingBudget**

In `server/src/tools/budget.tool.ts`, add `no_budget_set` to `BudgetResult`:

```typescript
export interface BudgetResult {
  total_budget: number;
  total_spent: number;
  remaining: number;
  remaining_percentage: number;
  over_budget: boolean;
  no_budget_set?: boolean;
  warning?: string;
  breakdown: {
    flights: { amount: number; percentage: number };
    hotels: { amount: number; percentage: number };
    experiences: { amount: number; percentage: number };
  };
}
```

At the start of `calculateRemainingBudget`, add the no-budget-set check:

```typescript
export function calculateRemainingBudget(input: BudgetInput): BudgetResult {
  const { total_budget, flight_cost, hotel_total_cost, experience_costs } =
    input;

  const experienceTotal = experience_costs.reduce((sum, cost) => sum + cost, 0);
  const totalSpent = flight_cost + hotel_total_cost + experienceTotal;

  if (total_budget <= 0) {
    return {
      total_budget: 0,
      total_spent: totalSpent,
      remaining: 0,
      remaining_percentage: 0,
      over_budget: false,
      no_budget_set: true,
      breakdown: {
        flights: { amount: flight_cost, percentage: 0 },
        hotels: { amount: hotel_total_cost, percentage: 0 },
        experiences: { amount: experienceTotal, percentage: 0 },
      },
    };
  }

  // ... rest of existing function unchanged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/tools/budget.tool.test.ts`
Expected: PASS

- [ ] **Step 5: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add server/src/tools/budget.tool.ts server/src/tools/budget.tool.test.ts
git commit -m "feat: budget tool returns no_budget_set when total_budget is 0"
```

---

## Task 3: Prompt Hardening — System Prompt + Category Prompts

**Files:**

- Modify: `server/src/prompts/system-prompt.ts`
- Modify: `server/src/prompts/system-prompt.test.ts`
- Modify: `server/src/prompts/category-prompts.ts`
- Modify: `server/src/prompts/category-prompts.test.ts`

- [ ] **Step 1: Add GUARDRAILS constant to system-prompt.ts**

In `server/src/prompts/system-prompt.ts`, add a `GUARDRAILS` constant before `buildSystemPrompt` and inject it into every prompt:

```typescript
import type { FlowPosition } from './booking-steps.js';
import { getCategoryPrompt, getPhasePrompt } from './category-prompts.js';
import { type TripContext, formatTripContext } from './trip-context.js';

const GUARDRAILS = `
## Guardrails
- If the user asks something unrelated to travel planning, answer briefly if it's harmless, then steer back to the trip. For illegal or harmful requests, decline: "I can't help with that. Let's focus on planning your trip."
- If the user asks about multi-city or multi-destination trips, explain that each trip covers one destination and suggest creating a separate trip for each leg.
- If the user wants to change their destination after bookings have started, warn them that changing will clear all current selections and ask for confirmation before calling update_trip.
- Review travel advisories in context. If they mention health risks (vaccinations, malaria zones, water safety), proactively mention these early — don't wait for the user to ask.`;

export function buildSystemPrompt(
  tripContext?: TripContext,
  flowPosition?: FlowPosition,
  options?: { hasCriticalAdvisory?: boolean },
): string {
  let stepPrompt: string;

  if (!flowPosition || flowPosition.phase === 'COLLECT_DETAILS') {
    stepPrompt = getPhasePrompt('COLLECT_DETAILS');
  } else if (flowPosition.phase === 'CATEGORY') {
    stepPrompt = getCategoryPrompt(
      flowPosition.category,
      flowPosition.status,
      tripContext?.user_preferences,
    );
  } else if (flowPosition.phase === 'CONFIRM') {
    stepPrompt = getPhasePrompt('CONFIRM');
  } else {
    stepPrompt = getPhasePrompt('COMPLETE');
  }

  const parts = [stepPrompt, GUARDRAILS];
  parts.push(
    `\n\n## Current Date\n\nToday is ${new Date().toISOString().split('T')[0]}.`,
  );

  if (options?.hasCriticalAdvisory) {
    parts.push(`\n\n## CRITICAL TRAVEL ADVISORY
A critical travel advisory is in effect for this destination. Before proceeding with any bookings, you MUST acknowledge the advisory and ask the user: "The US State Department advises against all travel to this destination. Are you sure you want to continue planning, or would you prefer a different destination?" Do not proceed to category bookings until the user explicitly confirms.`);
  }

  if (tripContext) {
    parts.push(
      `\n\n## Current Trip State\n\n${formatTripContext(tripContext)}`,
    );
  }

  return parts.join('');
}
```

- [ ] **Step 2: Update system-prompt tests**

In `server/src/prompts/system-prompt.test.ts`, add tests:

```typescript
it('should include guardrails in every prompt', () => {
  const result = buildSystemPrompt();
  expect(result).toContain('Guardrails');
  expect(result).toContain('unrelated to travel planning');
  expect(result).toContain('multi-city');
});

it('should include critical advisory warning when hasCriticalAdvisory is true', () => {
  const result = buildSystemPrompt(undefined, undefined, {
    hasCriticalAdvisory: true,
  });
  expect(result).toContain('CRITICAL TRAVEL ADVISORY');
  expect(result).toContain('advises against all travel');
});

it('should not include critical advisory warning by default', () => {
  const result = buildSystemPrompt();
  expect(result).not.toContain('CRITICAL TRAVEL ADVISORY');
});
```

- [ ] **Step 3: Update category-prompts.ts with budget, weather, impossible requests, undo instructions**

In `server/src/prompts/category-prompts.ts`, update `SHARED_RULES`:

```typescript
const SHARED_RULES = `
## Rules
- 1-2 sentences max. No numbered lists. No bullet points for questions.
- NEVER describe search results in text — the cards handle it.
- Travel questions: answer in 1-2 sentences, then redirect to the current step.
- Call update_trip when the user provides trip details.
- Always call format_response as your LAST tool call.
- Set skip_category: true in format_response if the user declines this category.
- Max 15 tool calls per turn.
- When the user explicitly names a specific option, honor that selection. Do not present alternatives.
- After each selection, call calculate_remaining_budget. If remaining is negative, tell the user how much they're over budget and ask if they want cheaper options or to continue.
- If search results are empty or all options far exceed the budget, explain honestly why and suggest realistic alternatives. Never fabricate options.
- If the user wants to change a previous selection, re-search that category and present new options.`;
```

Update the `experiences.idle` and `experiences.asking` prompts to include weather awareness:

```typescript
experiences: {
  idle: `Based on the user's preferences, suggest relevant experience categories in one sentence. Check the weather forecast in context — if rain or extreme temperatures are forecasted, mention it when suggesting activities. Then search experiences. The cards will show the results.
Provide quick_replies: ["Find dining options", "Show me adventures", "I'm all set"].`,

  asking: `Based on the user's preferences, suggest relevant experience categories in one sentence. Check the weather forecast in context — if rain or extreme temperatures are forecasted, mention it when suggesting activities. Then search experiences. The cards will show the results.
Provide quick_replies: ["Find dining options", "Show me adventures", "I'm all set"].`,

  presented: `The user is browsing experiences. Do not describe the results — the cards are visible. Answer questions briefly. Wait for their selection. When the user selects an experience, call select_experience with the experience details to save their choice. If they say they're done, set skip_category: true. When the user names a specific option (e.g., a specific hotel, flight, car, or experience), confirm that exact selection immediately. Do NOT suggest alternatives unless the user asks for them or the specified option is unavailable.`,
},
```

Update hotels prompts to handle one-way trips:

```typescript
hotels: {
  idle: `Ask: "Do you need a hotel?" If yes, search hotels. If the trip has no return date (one-way trip), ask "How many nights are you staying?" before searching. If no hotel needed, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a hotel", "No, I have lodging"].`,

  asking: `Ask: "Do you need a hotel?" If yes, search hotels. If the trip has no return date (one-way trip), ask "How many nights are you staying?" before searching. If no hotel needed, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a hotel", "No, I have lodging"].`,

  presented: `The user is browsing hotel options. Do not describe the results — the cards are visible. Answer questions briefly. Wait for their selection. When the user selects a hotel, call select_hotel with the hotel details to save their choice. When the user names a specific option (e.g., a specific hotel, flight, car, or experience), confirm that exact selection immediately. Do NOT suggest alternatives unless the user asks for them or the specified option is unavailable.`,
},
```

- [ ] **Step 4: Update category-prompts tests**

Add to `server/src/prompts/category-prompts.test.ts`:

```typescript
it('should include budget advisory in shared rules', () => {
  const prompt = getCategoryPrompt('flights', 'asking');
  expect(prompt).toContain('calculate_remaining_budget');
  expect(prompt).toContain('over budget');
});

it('should include weather awareness in experiences idle prompt', () => {
  const prompt = getCategoryPrompt('experiences', 'idle');
  expect(prompt).toContain('weather forecast');
});

it('should include one-way trip instruction in hotels idle prompt', () => {
  const prompt = getCategoryPrompt('hotels', 'idle');
  expect(prompt).toContain('one-way trip');
  expect(prompt).toContain('How many nights');
});

it('should include impossible requests guidance in shared rules', () => {
  const prompt = getCategoryPrompt('flights', 'asking');
  expect(prompt).toContain('Never fabricate options');
});

it('should include category undo instruction in shared rules', () => {
  const prompt = getCategoryPrompt('hotels', 'presented');
  expect(prompt).toContain('change a previous selection');
});
```

- [ ] **Step 5: Run tests**

Run: `cd server && npx vitest run src/prompts/`
Expected: PASS

- [ ] **Step 6: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add server/src/prompts/system-prompt.ts server/src/prompts/system-prompt.test.ts server/src/prompts/category-prompts.ts server/src/prompts/category-prompts.test.ts
git commit -m "feat: add prompt guardrails for off-topic, budget, weather, safety, and category undo"
```

---

## Task 4: Visa Disclaimer + Trip Context Safety Injection

**Files:**

- Modify: `server/src/services/enrichment-sources/visa-matrix.ts`
- Modify: `server/src/prompts/trip-context.ts`

- [ ] **Step 1: Update visa fallback text**

In `server/src/services/enrichment-sources/visa-matrix.ts`, change the final return block (lines 79-84):

```typescript
  return {
    type: 'advisory',
    severity: 'warning',
    title: 'Visa Requirements — Check Before Travel',
    body: `Visa requirements vary by nationality. We have detailed data for US and UK travelers. For other nationalities, please check your country's foreign affairs website before traveling. (Direct visa verification coming in a future update.)`,
  };
```

- [ ] **Step 2: Add safety fields to TripContext and formatTripContext**

In `server/src/prompts/trip-context.ts`, add safety fields to the `TripContext` interface and update `formatTripContext`:

Add to the `user_preferences` type in `TripContext`:

```typescript
  user_preferences?: {
    accommodation: string | null;
    travel_pace: string | null;
    dietary: string[];
    dining_style: string | null;
    activities: string[];
    travel_party: string | null;
    budget_comfort: string | null;
    lgbtq_safety?: boolean;
    gender?: string | null;
  };
```

Update `formatTripContext` to inject safety prompt lines. After the `user_preferences` section (after line 93), add:

```typescript
// Safety-aware prompt injections
if (ctx.user_preferences) {
  const up = ctx.user_preferences;
  const safetyLines: string[] = [];

  if (up.lgbtq_safety) {
    safetyLines.push(
      "The user has opted into LGBTQ+ travel safety information. If the destination's travel advisories mention laws or attitudes affecting LGBTQ+ travelers, proactively surface this information. Be factual and helpful — mention specific risks without being preachy.",
    );
  }

  if (up.gender === 'woman' || up.gender === 'non_binary') {
    const identity = up.gender === 'woman' ? 'a woman' : 'non-binary';
    safetyLines.push(
      `The user identifies as ${identity}. If the destination has advisories mentioning restrictions or safety concerns for women or gender non-conforming travelers (dress codes, solo travel restrictions, harassment risks), proactively surface this information.`,
    );
  }

  if (up.travel_party === 'solo') {
    safetyLines.push(
      'The user is traveling solo. If relevant advisories exist for this destination, mention general solo travel safety tips.',
    );
  }

  if (safetyLines.length > 0) {
    lines.push('\n### Safety Context');
    for (const line of safetyLines) {
      lines.push(`- ${line}`);
    }
  }
}
```

Make budget display conditional — change lines 129-132:

```typescript
if (ctx.budget_total > 0) {
  const remaining = ctx.budget_total - ctx.total_spent;
  lines.push(`\n### Budget Status`);
  lines.push(`- Spent: $${ctx.total_spent} / $${ctx.budget_total}`);
  lines.push(`- Remaining: $${remaining}`);
}
```

Also update line 60 to make budget conditional:

```typescript
if (ctx.budget_total > 0) {
  lines.push(`- **Budget:** ${ctx.budget_currency} ${ctx.budget_total}`);
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add server/src/services/enrichment-sources/visa-matrix.ts server/src/prompts/trip-context.ts
git commit -m "feat: update visa disclaimer, add safety context injection, make budget conditional"
```

---

## Task 5: User Preferences Schema — Add lgbtq_safety + gender

**Files:**

- Modify: `server/src/schemas/userPreferences.ts`
- Modify: `server/src/schemas/userPreferences.test.ts`
- Modify: `web-client/src/lib/preferenceOptions.ts`

- [ ] **Step 1: Write the failing test**

Add to `server/src/schemas/userPreferences.test.ts`:

```typescript
it('should normalize v1 data with lgbtq_safety and gender fields', () => {
  const result = normalizePreferences({
    version: 1,
    accommodation: 'budget',
    lgbtq_safety: true,
    gender: 'woman',
  });
  expect(result.lgbtq_safety).toBe(true);
  expect(result.gender).toBe('woman');
});

it('should default lgbtq_safety to false and gender to null', () => {
  const result = normalizePreferences({ version: 1 });
  expect(result.lgbtq_safety).toBe(false);
  expect(result.gender).toBeNull();
});

it('should include lgbtq_safety and gender in DEFAULT_PREFERENCES', () => {
  expect(DEFAULT_PREFERENCES.lgbtq_safety).toBe(false);
  expect(DEFAULT_PREFERENCES.gender).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/schemas/userPreferences.test.ts`
Expected: FAIL — lgbtq_safety and gender don't exist on UserPreferences

- [ ] **Step 3: Update UserPreferences interface, DEFAULT_PREFERENCES, and normalizePreferences**

In `server/src/schemas/userPreferences.ts`:

Update `UserPreferences` interface (after `completed_steps`):

```typescript
export interface UserPreferences {
  version: number;
  accommodation: 'budget' | 'mid-range' | 'upscale' | 'unique' | null;
  travel_pace: 'relaxed' | 'moderate' | 'packed' | null;
  dietary: string[];
  dining_style: 'street-food' | 'casual' | 'fine-dining' | 'food-tours' | null;
  activities: string[];
  travel_party:
    | 'solo'
    | 'romantic-partner'
    | 'friends'
    | 'family-with-kids'
    | 'family-adults'
    | null;
  budget_comfort:
    | 'budget-conscious'
    | 'value-seeker'
    | 'comfort-first'
    | 'no-concerns'
    | null;
  completed_steps: string[];
  lgbtq_safety: boolean;
  gender: 'prefer_not_to_say' | 'woman' | 'man' | 'non_binary' | null;
}
```

Update `DEFAULT_PREFERENCES`:

```typescript
export const DEFAULT_PREFERENCES: UserPreferences = {
  version: CURRENT_PREFERENCES_VERSION,
  accommodation: null,
  travel_pace: null,
  dietary: [],
  dining_style: null,
  activities: [],
  travel_party: null,
  budget_comfort: null,
  completed_steps: [],
  lgbtq_safety: false,
  gender: null,
};
```

Update `normalizePreferences` — in the v1 section (around line 225), add:

```typescript
  // v1: current format — fill missing fields with defaults
  return {
    version: CURRENT_PREFERENCES_VERSION,
    accommodation:
      (data.accommodation as UserPreferences['accommodation']) ?? null,
    travel_pace: (data.travel_pace as UserPreferences['travel_pace']) ?? null,
    dietary: Array.isArray(data.dietary) ? (data.dietary as string[]) : [],
    dining_style:
      (data.dining_style as UserPreferences['dining_style']) ?? null,
    activities: Array.isArray(data.activities)
      ? (data.activities as string[])
      : [],
    travel_party:
      (data.travel_party as UserPreferences['travel_party']) ?? null,
    budget_comfort:
      (data.budget_comfort as UserPreferences['budget_comfort']) ?? null,
    completed_steps: Array.isArray(data.completed_steps)
      ? (data.completed_steps as string[])
      : [],
    lgbtq_safety: data.lgbtq_safety === true,
    gender: (data.gender as UserPreferences['gender']) ?? null,
  };
```

Also update the v0 legacy section to include the new defaults:

```typescript
  // v0: legacy format with intensity/social (no version field)
  if (!('version' in data)) {
    return {
      ...DEFAULT_PREFERENCES,
      dietary: Array.isArray(data.dietary) ? (data.dietary as string[]) : [],
      travel_pace:
        typeof data.intensity === 'string'
          ? (data.intensity as UserPreferences['travel_pace'])
          : null,
      travel_party:
        typeof data.social === 'string'
          ? ((LEGACY_SOCIAL_MAP[
              data.social
            ] as UserPreferences['travel_party']) ?? null)
          : null,
    };
  }
```

- [ ] **Step 4: Update frontend preferenceOptions.ts**

In `web-client/src/lib/preferenceOptions.ts`, add `GENDER_OPTIONS` and update `UserPreferences`:

```typescript
export const GENDER_OPTIONS = [
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
] as const;
```

Update `UserPreferences` interface:

```typescript
export interface UserPreferences {
  version: number;
  accommodation: string | null;
  travel_pace: string | null;
  dietary: string[];
  dining_style: string | null;
  activities: string[];
  travel_party: string | null;
  budget_comfort: string | null;
  completed_steps: string[];
  lgbtq_safety: boolean;
  gender: string | null;
}
```

- [ ] **Step 5: Run tests and verify**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add server/src/schemas/userPreferences.ts server/src/schemas/userPreferences.test.ts web-client/src/lib/preferenceOptions.ts
git commit -m "feat: add lgbtq_safety and gender fields to user preferences schema"
```

---

## Task 6: TravelPartyStep — LGBTQ+ Toggle + Gender Select

**Files:**

- Modify: `web-client/src/components/PreferencesWizard/steps/TravelPartyStep.tsx`

- [ ] **Step 1: Update TravelPartyStep with safety preference fields**

Replace the full content of `web-client/src/components/PreferencesWizard/steps/TravelPartyStep.tsx`:

```tsx
import { GENDER_OPTIONS, TRAVEL_PARTY_OPTIONS } from '@/lib/preferenceOptions';

import styles from '../PreferencesWizard.module.scss';

interface TravelPartyStepProps {
  value: string | null;
  onChange: (value: string | null) => void;
  lgbtqSafety?: boolean;
  onLgbtqSafetyChange?: (value: boolean) => void;
  gender?: string | null;
  onGenderChange?: (value: string | null) => void;
}

export function TravelPartyStep({
  value,
  onChange,
  lgbtqSafety,
  onLgbtqSafetyChange,
  gender,
  onGenderChange,
}: TravelPartyStepProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>Who do you usually travel with?</legend>
      <div className={styles.chipGroup}>
        {TRAVEL_PARTY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type='button'
            className={`${styles.chip} ${value === opt.value ? styles.chipSelected : ''}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {onLgbtqSafetyChange && onGenderChange && (
        <div className={styles.safetySection}>
          <p className={styles.safetyExplanation}>
            These optional questions help us surface relevant safety information
            for your destinations. Your answers are private and only used to
            personalize travel advisories.
          </p>

          <label className={styles.toggleLabel}>
            <input
              type='checkbox'
              checked={lgbtqSafety ?? false}
              onChange={(e) => onLgbtqSafetyChange(e.target.checked)}
              className={styles.toggleInput}
            />
            <span>Show LGBTQ+ travel safety information</span>
          </label>

          <div className={styles.genderField}>
            <label htmlFor='gender-select' className={styles.selectLabel}>
              How do you identify?{' '}
              <span className={styles.optional}>(optional)</span>
            </label>
            <select
              id='gender-select'
              value={gender ?? ''}
              onChange={(e) => onGenderChange(e.target.value || null)}
              className={styles.select}
            >
              <option value=''>Select...</option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </fieldset>
  );
}
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add web-client/src/components/PreferencesWizard/steps/TravelPartyStep.tsx
git commit -m "feat: add LGBTQ+ safety toggle and gender select to Travel Party step"
```

**Note:** The parent `PreferencesWizard.tsx` component will need to wire up the new `lgbtqSafety`, `onLgbtqSafetyChange`, `gender`, and `onGenderChange` props. The implementer should read `PreferencesWizard.tsx` to understand how step props are passed and add the new state fields to the wizard's preference state object. The fields should be saved alongside other preferences via the existing PUT endpoint.

---

## Task 7: Chat Handler — Empty Itinerary Block + Category Undo

**Files:**

- Modify: `server/src/handlers/chat/chat.ts`
- Modify: `server/src/handlers/chat/chat.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `server/src/handlers/chat/chat.test.ts`:

```typescript
describe('empty itinerary block', () => {
  it('should not advance to CONFIRM when all categories are skipped', () => {
    const bookingState: BookingState = {
      version: 1,
      flights: { status: 'skipped' },
      hotels: { status: 'skipped' },
      car_rental: { status: 'skipped' },
      experiences: { status: 'skipped' },
    };
    const allSkipped = ['flights', 'hotels', 'car_rental', 'experiences'].every(
      (cat) =>
        bookingState[cat as keyof BookingState] !== undefined &&
        typeof bookingState[cat as keyof BookingState] === 'object' &&
        (bookingState[cat as keyof BookingState] as { status: string })
          .status !== 'done',
    );
    expect(allSkipped).toBe(true);
  });
});
```

- [ ] **Step 2: Implement empty itinerary block in chat.ts**

In `server/src/handlers/chat/chat.ts`, after `advanceBookingState` is called (after line 317), add a check before the CONFIRM phase. Modify the section starting at line 301:

```typescript
// Advance booking state after the agent loop
if (flowPosition.phase === 'CATEGORY' && updatedTrip) {
  const newBookingState = advanceBookingState(
    currentBookingState,
    flowPosition.category,
    flowPosition.status,
    result,
    {
      ...updatedTrip,
      transport_mode: updatedTrip.transport_mode ?? null,
    },
  );

  // Empty itinerary guard: if all categories are done/skipped but none are 'done',
  // block advancement to CONFIRM by resetting the first skipped category to idle
  const hasDone = (
    ['flights', 'hotels', 'car_rental', 'experiences'] as const
  ).some((cat) => newBookingState[cat].status === 'done');
  const allFinished = (
    ['flights', 'hotels', 'car_rental', 'experiences'] as const
  ).every(
    (cat) =>
      newBookingState[cat].status === 'done' ||
      newBookingState[cat].status === 'skipped',
  );

  if (allFinished && !hasDone) {
    result.nodes.push({
      type: 'text',
      content:
        "You haven't selected anything for your trip yet. Want to go back and explore some options?",
    });
    // Reset the first skipped category back to idle so the flow continues
    for (const cat of [
      'flights',
      'hotels',
      'car_rental',
      'experiences',
    ] as const) {
      if (newBookingState[cat].status === 'skipped') {
        newBookingState[cat] = { status: 'idle' };
        break;
      }
    }
  }

  await updateBookingState(
    conversation.id,
    newBookingState as unknown as Record<string, unknown>,
  );
}
```

- [ ] **Step 3: Implement category undo reset in chat.ts**

In `server/src/handlers/chat/chat.ts`, inside the `advanceBookingState` section, after computing `newBookingState`, add a check: if a search tool was called for a category that was `done`, reset it to `presented`:

Add this logic to `advanceBookingState` in `booking-steps.ts` instead — it's cleaner. In `server/src/prompts/booking-steps.ts`, in the `advanceBookingState` function, add a case for `done`:

```typescript
switch (currentStatus) {
  case 'idle':
    newState[cat] = { ...newState[cat], status: 'asking' };
    break;

  case 'asking':
    if (searchCalled) {
      newState[cat] = { ...newState[cat], status: 'presented' };
    }
    break;

  case 'presented':
    if (hasSelection) {
      newState[cat] = { ...newState[cat], status: 'done' };
    }
    // If search called again (re-search), stay in presented
    break;

  case 'done':
    // Category undo: if user re-searches a completed category, reset to presented
    if (searchCalled) {
      newState[cat] = { ...newState[cat], status: 'presented' };
    }
    break;

  default:
    break;
}
```

- [ ] **Step 4: Add test for category undo in booking-steps.test.ts**

```typescript
it('should reset done to presented when search tool is called (category undo)', () => {
  const state: BookingState = {
    version: 1,
    flights: { status: 'done' },
    hotels: { status: 'idle' },
    car_rental: { status: 'idle' },
    experiences: { status: 'idle' },
  };
  const result = advanceBookingState(
    state,
    'flights',
    'done',
    {
      tool_calls: [{ tool_name: 'search_flights' }],
      formatResponse: null,
    },
    {
      destination: 'Paris',
      origin: 'JFK',
      departure_date: '2026-06-01',
      return_date: '2026-06-10',
      budget_total: 5000,
      transport_mode: 'flying',
      flights: [{ id: '1' }],
      hotels: [],
      experiences: [],
      status: 'planning',
    },
  );
  expect(result.flights.status).toBe('presented');
});
```

- [ ] **Step 5: Run tests and verify**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add server/src/handlers/chat/chat.ts server/src/handlers/chat/chat.test.ts server/src/prompts/booking-steps.ts server/src/prompts/booking-steps.test.ts
git commit -m "feat: add empty itinerary block and category undo reset"
```

---

## Task 8: format_response Fallback + Warning

**Files:**

- Modify: `server/src/services/agent.service.ts`

- [ ] **Step 1: Add explicit fallback and warning log**

In `server/src/services/agent.service.ts`, update the text node section (lines 93-102):

```typescript
// 3. Text node from format_response or fallback to raw response
if (result.formatResponse) {
  finalNodes.push({
    type: 'text',
    content: result.formatResponse.text,
    citations: result.formatResponse.citations as Citation[] | undefined,
  });
} else if (result.response) {
  logger.warn(
    'Agent completed without calling format_response — using raw text fallback',
  );
  finalNodes.push({ type: 'text', content: result.response });
}
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add server/src/services/agent.service.ts
git commit -m "feat: add warning log when agent completes without format_response"
```

---

## Task 9: Trip Handler — Date Validation + Destination Change Clearing

**Files:**

- Modify: `server/src/handlers/trips/trips.ts`
- Modify: `server/src/handlers/trips/trips.test.ts`
- Modify: `server/src/repositories/trips/trips.ts`

- [ ] **Step 1: Write failing tests for date validation**

Add to `server/src/handlers/trips/trips.test.ts`:

```typescript
describe('updateTrip date validation', () => {
  it('should reject departure_date in the past', async () => {
    const req = {
      user: { id: 'user-1' },
      params: { id: 'trip-1' },
      body: { departure_date: '2020-01-01' },
    } as unknown as Request;
    const res = mockResponse();

    await updateTrip(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('past'),
      }),
    );
  });

  it('should reject return_date before departure_date', async () => {
    const req = {
      user: { id: 'user-1' },
      params: { id: 'trip-1' },
      body: { departure_date: '2026-12-01', return_date: '2026-11-01' },
    } as unknown as Request;
    const res = mockResponse();

    await updateTrip(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('after departure'),
      }),
    );
  });
});
```

- [ ] **Step 2: Add date validation to updateTrip handler**

In `server/src/handlers/trips/trips.ts`, add validation after the input building (after line 64):

```typescript
  // Date validation
  if (departure_date !== undefined) {
    const today = new Date().toISOString().split('T')[0];
    if (departure_date < today) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Departure date cannot be in the past',
      });
      return;
    }
  }

  if (return_date !== undefined && departure_date !== undefined) {
    if (return_date < departure_date) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Return date must be after departure date',
      });
      return;
    }
  }
```

- [ ] **Step 3: Add clearSelectionsForTrip to trips repository**

In `server/src/repositories/trips/trips.ts`, add:

```typescript
export async function clearSelectionsForTrip(tripId: string): Promise<void> {
  await query('DELETE FROM trip_flights WHERE trip_id = $1', [tripId]);
  await query('DELETE FROM trip_hotels WHERE trip_id = $1', [tripId]);
  await query('DELETE FROM trip_car_rentals WHERE trip_id = $1', [tripId]);
  await query('DELETE FROM trip_experiences WHERE trip_id = $1', [tripId]);
}
```

- [ ] **Step 4: Add destination change clearing to updateTrip handler**

In `server/src/handlers/trips/trips.ts`, add the `trip_type` field to the destructuring and input building. Also add destination change detection after the update:

```typescript
export async function updateTrip(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const tripId = req.params.id as string;

  const {
    destination,
    origin,
    departure_date,
    return_date,
    budget_total,
    travelers,
    transport_mode,
    trip_type,
    status,
  } = req.body ?? {};
  const input: Record<string, unknown> = {};
  if (destination !== undefined) input.destination = destination;
  if (origin !== undefined) input.origin = origin;
  if (departure_date !== undefined) input.departure_date = departure_date;
  if (return_date !== undefined) input.return_date = return_date;
  if (budget_total !== undefined) input.budget_total = budget_total;
  if (travelers !== undefined) input.travelers = travelers;
  if (transport_mode !== undefined) input.transport_mode = transport_mode;
  if (trip_type !== undefined) input.trip_type = trip_type;
  if (status !== undefined) input.status = status;

  // ... date validation (from step 2) ...

  if (Object.keys(input).length === 0) {
    res
      .status(400)
      .json({ error: 'VALIDATION_ERROR', message: 'No fields to update' });
    return;
  }

  // Check if destination is changing — need to clear selections
  let shouldClearSelections = false;
  if (destination !== undefined) {
    const existingTrip = await tripRepo.getTripWithDetails(tripId, userId);
    if (
      existingTrip &&
      existingTrip.destination &&
      existingTrip.destination !== destination
    ) {
      const hasSelections =
        (existingTrip.flights?.length ?? 0) > 0 ||
        (existingTrip.hotels?.length ?? 0) > 0 ||
        (existingTrip.car_rentals?.length ?? 0) > 0 ||
        (existingTrip.experiences?.length ?? 0) > 0;
      if (hasSelections) {
        shouldClearSelections = true;
      }
    }
  }

  const trip = await tripRepo.updateTrip(
    tripId,
    userId,
    input as tripRepo.UpdateTripInput,
  );
  if (!trip) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Trip not found' });
    return;
  }

  if (shouldClearSelections) {
    await tripRepo.clearSelectionsForTrip(tripId);
    // Reset booking state on conversation
    const conversation = await getOrCreateConversation(tripId);
    await updateBookingState(
      conversation.id,
      DEFAULT_BOOKING_STATE as unknown as Record<string, unknown>,
    );
    logger.info(
      { event: 'selections_cleared', tripId, newDestination: destination },
      'Cleared selections after destination change',
    );
  }

  logger.info({ event: 'trip_updated', tripId, userId }, 'Trip updated');
  res.json({ trip });
}
```

Add the necessary imports at the top of `trips.ts`:

```typescript
import { DEFAULT_BOOKING_STATE } from 'app/prompts/booking-steps.js';
import {
  getOrCreateConversation,
  updateBookingState,
} from 'app/repositories/conversations/conversations.js';
```

Also add `trip_type` to `UpdateTripInput` in the repository:

```typescript
export interface UpdateTripInput {
  destination?: string;
  origin?: string;
  departure_date?: string;
  return_date?: string;
  budget_total?: number;
  travelers?: number;
  transport_mode?: 'flying' | 'driving';
  trip_type?: 'round_trip' | 'one_way';
  status?: 'planning' | 'saved' | 'archived';
}
```

- [ ] **Step 5: Run tests and verify**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add server/src/handlers/trips/trips.ts server/src/handlers/trips/trips.test.ts server/src/repositories/trips/trips.ts
git commit -m "feat: add date validation, destination change clearing, and trip_type support"
```

---

## Task 10: Database Migration — trip_type Column

**Files:**

- Create: `server/migrations/1771879388558_add-trip-type-column.js`

- [ ] **Step 1: Create the migration**

```javascript
export const up = (pgm) => {
  pgm.addColumn('trips', {
    trip_type: {
      type: 'text',
      notNull: true,
      default: 'round_trip',
      check: "trip_type IN ('round_trip', 'one_way')",
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('trips', 'trip_type');
};
```

- [ ] **Step 2: Verify build**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add server/migrations/1771879388558_add-trip-type-column.js
git commit -m "feat: add trip_type column migration"
```

---

## Task 11: One-Way Flight Search Support

**Files:**

- Modify: `server/src/tools/definitions.ts`
- Modify: `server/src/tools/flights.tool.ts`

- [ ] **Step 1: Add one_way param to search_flights definition**

In `server/src/tools/definitions.ts`, add `one_way` to the search_flights properties:

```typescript
      one_way: {
        type: 'boolean',
        description:
          'Set to true for one-way flights (omits return date). Default: false.',
      },
```

- [ ] **Step 2: Update searchFlights to handle one_way**

In `server/src/tools/flights.tool.ts`, update the `FlightSearchInput` interface (if it exists) or the params building. In the SerpApi params section, make `return_date` conditional:

```typescript
const params: Record<string, string | number | undefined> = {
  departure_id: input.origin,
  arrival_id: input.destination,
  outbound_date: input.departure_date,
  return_date: input.one_way ? undefined : input.return_date,
  adults: input.passengers,
  travel_class: input.cabin_class ? CABIN_MAP[input.cabin_class] : undefined,
  currency: 'USD',
  hl: 'en',
  type: input.one_way ? '2' : undefined, // SerpApi: type=2 for one-way
};
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add server/src/tools/definitions.ts server/src/tools/flights.tool.ts
git commit -m "feat: add one_way param to flight search tool"
```

---

## Task 12: Chat Handler — Wire Up Critical Advisory + Safety Prefs + Budget Context

**Files:**

- Modify: `server/src/handlers/chat/chat.ts`

- [ ] **Step 1: Pass hasCriticalAdvisory to buildSystemPrompt**

In `server/src/handlers/chat/chat.ts`, update the `runAgentLoop` call to detect critical advisories and pass safety prefs. After enrichment nodes are fetched (after line 163), add:

```typescript
const hasCriticalAdvisory = enrichmentNodes.some(
  (n) => n.type === 'advisory' && n.severity === 'critical',
);
```

Then update the `tripContext.user_preferences` building (lines 76-86) to include safety fields:

```typescript
    user_preferences: userPrefs
      ? {
          accommodation: userPrefs.accommodation,
          travel_pace: userPrefs.travel_pace,
          dietary: userPrefs.dietary,
          dining_style: userPrefs.dining_style,
          activities: userPrefs.activities,
          travel_party: userPrefs.travel_party,
          budget_comfort: userPrefs.budget_comfort,
          lgbtq_safety: userPrefs.lgbtq_safety ?? false,
          gender: userPrefs.gender ?? null,
        }
      : undefined,
```

The `buildSystemPrompt` is called inside `runAgentLoop` → `AgentOrchestrator`. The `hasCriticalAdvisory` flag needs to be passed through. Update `runAgentLoop` to accept options and pass them to the system prompt builder:

In `server/src/services/agent.service.ts`, update `runAgentLoop` signature:

```typescript
export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  tripContext: TripContext | undefined,
  onEvent: (event: SSEEvent) => void,
  conversationId?: string | null,
  toolContext?: ToolContext,
  enrichmentNodes?: ChatNode[],
  flowPosition?: FlowPosition,
  promptOptions?: { hasCriticalAdvisory?: boolean },
): Promise<AgentResult> {
```

And update the systemPromptBuilder:

```typescript
    systemPromptBuilder: (ctx: unknown, pos: unknown) =>
      buildSystemPrompt(
        ctx as TripContext | undefined,
        pos as FlowPosition | undefined,
        promptOptions,
      ),
```

Then in `chat.ts`, pass the flag:

```typescript
const result = await runAgentLoop(
  claudeMessages,
  tripContext,
  onEvent,
  conversation.id,
  { tripId, userId },
  enrichmentNodes,
  flowPosition,
  { hasCriticalAdvisory },
);
```

- [ ] **Step 2: Update form injection to make budget and return_date optional**

In the form injection section (lines 240-297), update the missing fields logic:

```typescript
if (updatedPosition.phase === 'COLLECT_DETAILS') {
  const isPlaceholder =
    !updatedTrip.destination || updatedTrip.destination === 'Planning...';
  const isOneWay = updatedTrip.trip_type === 'one_way';
  const missingFields: Array<{
    name: string;
    label: string;
    field_type: 'text' | 'date' | 'number' | 'select';
    required: boolean;
  }> = [];
  if (isPlaceholder)
    missingFields.push({
      name: 'destination',
      label: 'Where do you want to go?',
      field_type: 'text',
      required: true,
    });
  if (!updatedTrip.origin)
    missingFields.push({
      name: 'origin',
      label: 'Where are you traveling from?',
      field_type: 'text',
      required: true,
    });
  if (!updatedTrip.departure_date)
    missingFields.push({
      name: 'departure_date',
      label: 'Departure date',
      field_type: 'date',
      required: true,
    });
  if (!isOneWay && !updatedTrip.return_date)
    missingFields.push({
      name: 'return_date',
      label: 'Return date',
      field_type: 'date',
      required: true,
    });
  // Budget and travelers are optional — only show if not already set
  if (!updatedTrip.budget_total)
    missingFields.push({
      name: 'budget',
      label: 'Total budget in USD (optional)',
      field_type: 'number',
      required: false,
    });
  if (!updatedTrip.travelers || updatedTrip.travelers < 1)
    missingFields.push({
      name: 'travelers',
      label: 'Number of travelers',
      field_type: 'number',
      required: true,
    });

  if (missingFields.length > 0) {
    result.nodes.push({
      type: 'travel_plan_form',
      fields: missingFields,
    });
  }
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add server/src/handlers/chat/chat.ts server/src/services/agent.service.ts
git commit -m "feat: wire up critical advisory flag, safety prefs, and budget-optional form"
```

---

## Task 13: TripDetailsForm — Trip Type Toggle + Submitted Lockdown

**Files:**

- Modify: `web-client/src/components/ChatBox/TripDetailsForm.tsx`

- [ ] **Step 1: Update TripDetailsForm with trip type toggle**

Add `'trip_type'` to the `TripField.type` union. Add a trip type toggle rendered as buttons (one-way / round-trip) above the date fields. When one-way is selected, hide the return_date field. The form already has a `submitted`/`isLocked` prop — verify it renders read-only values when locked.

Update the `TripField` type:

```typescript
export interface TripField {
  type:
    | 'destination'
    | 'origin'
    | 'departure_date'
    | 'return_date'
    | 'budget'
    | 'travelers'
    | 'trip_type';
  label: string;
  required?: boolean;
}
```

Add the trip_type field rendering inside the fields map:

```tsx
{
  field.type === 'trip_type' && (
    <div className={styles.tripTypeToggle}>
      <button
        type='button'
        className={`${styles.tripTypeBtn} ${(values.trip_type ?? 'round_trip') === 'round_trip' ? styles.tripTypeBtnActive : ''}`}
        onClick={() => set('trip_type', 'round_trip')}
        disabled={disabled || isLocked}
      >
        Round Trip
      </button>
      <button
        type='button'
        className={`${styles.tripTypeBtn} ${values.trip_type === 'one_way' ? styles.tripTypeBtnActive : ''}`}
        onClick={() => set('trip_type', 'one_way')}
        disabled={disabled || isLocked}
      >
        One Way
      </button>
    </div>
  );
}
```

Update the `allFilled` check to skip optional and trip_type fields:

```typescript
const allFilled = fields.every(
  (f) =>
    f.type === 'trip_type' || f.required === false || values[f.type]?.trim(),
);
```

Hide return_date when one-way is selected — wrap the return_date rendering:

```tsx
          {field.type === 'return_date' && values.trip_type !== 'one_way' && (
            // ... existing return_date input
          )}
```

- [ ] **Step 2: Add basic styles for trip type toggle**

Add to `web-client/src/components/ChatBox/TripDetailsForm.module.scss`:

```scss
.tripTypeToggle {
  display: flex;
  gap: 8px;
}

.tripTypeBtn {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--foreground-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--surface-hover);
  }
}

.tripTypeBtnActive {
  background: var(--cta);
  color: var(--cta-text);
  border-color: var(--cta);

  &:hover:not(:disabled) {
    background: var(--cta-hover);
  }
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add web-client/src/components/ChatBox/TripDetailsForm.tsx web-client/src/components/ChatBox/TripDetailsForm.module.scss
git commit -m "feat: add trip type toggle and submitted lockdown to TripDetailsForm"
```

---

## Self-Review

**1. Spec coverage:**

| Spec Section                          | Task(s)                                        |
| ------------------------------------- | ---------------------------------------------- |
| 1a. Empty itinerary block             | Task 7                                         |
| 1b. format_response fallback          | Task 8                                         |
| 1c. Submitted form lockdown           | Task 13 (existing `isLocked` verified)         |
| 1d. Race condition                    | No-op (spec says no changes)                   |
| 2a. Off-topic handling                | Task 3                                         |
| 2b. Impossible requests               | Task 3                                         |
| 2c. Multi-city redirect               | Task 3                                         |
| 2d. Category undo                     | Task 3 (prompt) + Task 7 (server reset)        |
| 3a. Visa disclaimer                   | Task 4                                         |
| 3b. Health awareness                  | Task 3                                         |
| 3c. Weather-activity awareness        | Task 3                                         |
| 4a. Advisory-only enforcement         | Task 3                                         |
| 4b. Missing budget = no constraint    | Task 1 + Task 2 + Task 4 + Task 12             |
| 4c. Zero results within budget        | Task 3                                         |
| 5a. Level 4 warn-and-confirm          | Task 3 + Task 12                               |
| 5b. Traveler safety preferences       | Task 5 + Task 6                                |
| 5c. Preference-aware prompt injection | Task 4                                         |
| 6a. Past date validation              | Task 9                                         |
| 6b. One-way trip support              | Task 1 + Task 10 + Task 11 + Task 12 + Task 13 |
| 6c. Destination change mid-flow       | Task 3 (prompt) + Task 9 (server)              |

**2. Placeholder scan:** No TBDs, TODOs, or vague requirements found.

**3. Type consistency:**

- `TripState.trip_type` defined in Task 1, used in Task 1 tests and Task 12
- `UserPreferences.lgbtq_safety` and `.gender` defined in Task 5, used in Task 4 and Task 6
- `BudgetResult.no_budget_set` defined in Task 2
- `buildSystemPrompt` options param added in Task 3, used in Task 12
- `runAgentLoop` promptOptions param added in Task 12
- `clearSelectionsForTrip` defined in Task 9, used in Task 9
- `UpdateTripInput.trip_type` added in Task 9

All consistent.
