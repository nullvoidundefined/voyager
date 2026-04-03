# Chat Edge Case Hardening — Design Spec

**Goal:** War-game the chat conversation flow and harden it against edge cases across conversation robustness, data quality, budget handling, dangerous destinations, and trip logistics. Also add one-way trip support.

**Approach:** Server-side guards for data integrity and safety-critical checks. Prompt-level instructions for conversational behavior. Both layers working together.

---

## 1. Conversation Robustness — Server-Side Guards

### 1a. Empty Itinerary Block

In the chat handler, before advancing to the CONFIRM phase, verify that at least one booking category has `status: 'done'`. If all categories are `skipped` or `idle`, do not advance to CONFIRM. Instead, inject a text node:

> "You haven't selected anything for your trip yet. Want to go back and explore some options?"

Stay in the current CATEGORY phase. The state machine picks the first non-done/non-skipped category and re-enters it.

### 1b. format_response Fallback

If the agent loop ends (`stop_reason: 'end_turn'`) without `formatResponseData` being set, wrap the accumulated streamed text into a `{ type: 'text', content }` node. Log a warning: `"Agent completed without calling format_response"`. No retry — the fallback text is sufficient.

### 1c. Submitted Form Lockdown

The `TripDetailsForm` component tracks a `submitted` state. Once the form is submitted successfully:

- Re-render as read-only, displaying the submitted values (destination, origin, dates, budget, travelers)
- No edit button — the form is informational only
- Server does not re-inject the form if the required fields (destination, origin, departure_date) are already populated

### 1d. Race Condition

No backend changes. The frontend already disables the chat input during streaming. Trust the existing behavior.

---

## 2. Conversation Robustness — Prompt-Level

### 2a. Off-Topic Handling

Add to system prompt base instructions:

> If the user asks something unrelated to travel planning, answer briefly and helpfully if it's harmless, then steer back to the trip. Example: "Great question! The capital of France is Paris. Now, about your hotel preferences..." For requests involving illegal activities or harmful content, decline firmly: "I can't help with that. Let's focus on planning your trip."

### 2b. Impossible Requests

Add to all category prompts:

> If search results are empty or all options far exceed the budget, explain honestly why (e.g., "Direct flights from Des Moines to Maldives don't exist — you'd need a connection through a major hub") and suggest realistic alternatives. Never fabricate options.

### 2c. Multi-City Redirect

Add to system prompt:

> If the user asks about multi-city or multi-destination trips, explain that each trip covers one destination and suggest creating a separate trip for each leg.

### 2d. Category Undo

Add to presented/done category prompts:

> If the user wants to change a previous selection (e.g., "I want a different hotel"), reset that category by re-searching and presenting new options. Use the appropriate search tool again.

Server support: when Claude calls a search tool for a category that's already `done`, the chat handler resets that category's status back to `presented` after the search completes.

---

## 3. Data Quality — Prompt-Level

### 3a. Visa Disclaimer

Change the visa matrix fallback text (for non-US/UK origins) from the generic "visa likely required" to:

> "Visa requirements vary by nationality. We have detailed data for US and UK travelers. For other nationalities, please check your country's foreign affairs website before traveling. (Direct visa verification coming in a future update.)"

### 3b. Health Awareness

Add to system prompt when enrichment advisories are present:

> Review the travel advisories in your context. If they mention health risks (vaccinations, malaria zones, water safety), proactively mention these to the user early in the conversation — don't wait for them to ask.

### 3c. Weather-Activity Awareness

Add to the experiences category prompt:

> Before suggesting outdoor activities, check the weather forecast in your context. If rain or extreme temperatures are forecasted during the trip dates, mention it when presenting options: "Heads up — rain is likely on the 15th, so you might want indoor alternatives."

---

## 4. Budget Edge Cases

### 4a. Advisory-Only Enforcement

No server-side blocking on budget overages. Claude warns vocally. Add to all category prompts:

> After each selection, call `calculate_remaining_budget`. If remaining is negative, tell the user: "This puts you $X over your $Y budget. Want to see cheaper options or continue with this choice?" Never refuse to book — the user decides.

### 4b. Missing Budget = No Constraint

In `getFlowPosition()`, remove `budget_total` from the COLLECT_DETAILS required fields. Only require: `destination`, `origin`, `departure_date`.

When budget is null/missing:

- Claude skips all budget references in conversation
- `budget_bar` node is not emitted
- `calculate_remaining_budget` returns a "no budget set" response instead of NaN

### 4c. Zero Results Within Budget

Add to all search category prompts:

> If all search results exceed the remaining budget, present them anyway but note: "These options are above your remaining budget of $X. You could increase your budget, skip this category, or I can search with different criteria."

---

## 5. Dangerous Destination Handling

### 5a. Level 4 Warn-and-Confirm

After enrichment nodes are fetched on first message, check if any advisory has `severity: 'critical'`. If so, add an instruction to the system prompt for that turn:

> A critical travel advisory is in effect for this destination. Before proceeding with any bookings, you MUST acknowledge the advisory and ask the user: "The US State Department advises against all travel to [destination]. Are you sure you want to continue planning this trip, or would you prefer a different destination?" Do not proceed to category bookings until the user explicitly confirms.

This is prompt-level only — no server blocking. The user can always confirm and proceed.

### 5b. Preference-Aware Safety Signals

When building the trip context, check user preferences for signals worth flagging. Add prompt instructions when detected:

- **`travel_party: 'partner'`** + destination with LGBTQ+ safety concerns in advisory text: Claude mentions "Some local laws may affect LGBTQ+ travelers — research current conditions before your trip."
- **`travel_party: 'solo'`** + relevant advisories: Claude mentions general solo travel safety tips for the destination.

No separate database of unsafe countries needed. The FCDO and State Dept advisories already contain relevant language. The prompt instruction tells Claude to surface it if present in the advisory text.

---

## 6. Trip Logistics

### 6a. Past Date Validation

**Server-side:** In `update_trip` handler, reject `departure_date` before today with a 400 error. Reject `return_date` before `departure_date` when both are provided. Error messages: "Departure date cannot be in the past" / "Return date must be after departure date."

**Client-side:** `TripDetailsForm` disables past dates in the date picker. Mirror the same validation before submission.

### 6b. One-Way Trip Support

**Database:** Add `trip_type` column to trips table: `'round_trip' | 'one_way'`, default `'round_trip'`. Migration adds the column with default value.

**COLLECT_DETAILS gate:** Only require `destination`, `origin`, and `departure_date`. Remove `return_date` from required fields. When `trip_type` is `'one_way'`, `return_date` is null and that's valid.

**TripDetailsForm:** Add a trip type toggle (round-trip / one-way). Selecting one-way hides the return date field. Default is round-trip.

**Flight search:** `search_flights` tool gets a `one_way: boolean` parameter. When true, SerpApi is called without return date. The tool definition schema is updated to include this optional parameter.

**Hotels prompt adjustment:** When `return_date` is null (one-way trip), Claude asks "How many nights are you staying?" rather than deriving duration from dates. Hotel search uses the user's answer for `check_out_date`.

**Booking state machine:** Unchanged — categories still flow in the same order regardless of trip type.

### 6c. Destination Change Mid-Flow

**Prompt-level:** Add to system prompt:

> If the user wants to change their destination after bookings have started, warn them: "Changing to [new destination] will clear your current selections ([list what's booked]). Want to proceed?" If they confirm, call `update_trip` with the new destination.

**Server-side:** In the `update_trip` handler, when the `destination` field changes and any selection tables have rows for this trip:

1. Delete all rows from `trip_flights`, `trip_hotels`, `trip_car_rentals`, `trip_experiences` for this trip
2. Reset `booking_state` on the conversation to all-idle (every category back to `{ status: 'idle' }`)
3. Return the updated trip

This ensures no stale selections from a previous destination persist.

---

## Summary of Changes by Layer

### Server-Side Changes

| Change                                          | File(s)                                      |
| ----------------------------------------------- | -------------------------------------------- |
| Empty itinerary block                           | `chat.ts` (handler)                          |
| format_response fallback + warning              | `agent.service.ts` or `AgentOrchestrator.ts` |
| Past date validation                            | `trips.ts` (handler)                         |
| One-way trip: DB migration                      | New migration file                           |
| One-way trip: trip_type in update_trip          | `trips.ts` (handler), `trips.ts` (schema)    |
| One-way trip: flight search param               | `flights.tool.ts`, `definitions.ts`          |
| Destination change clears selections            | `trips.ts` (handler)                         |
| Budget optional in COLLECT_DETAILS              | `booking-steps.ts`                           |
| Budget tool handles missing budget              | `budget.tool.ts`                             |
| Category undo (re-search resets done→presented) | `chat.ts` (handler)                          |

### Prompt-Level Changes

| Change                               | File(s)                                 |
| ------------------------------------ | --------------------------------------- |
| Off-topic handling                   | `system-prompt.ts`                      |
| Impossible requests                  | `category-prompts.ts`                   |
| Multi-city redirect                  | `system-prompt.ts`                      |
| Category undo instructions           | `category-prompts.ts`                   |
| Visa disclaimer text                 | `visa-matrix.ts`                        |
| Health awareness                     | `system-prompt.ts`                      |
| Weather-activity awareness           | `category-prompts.ts` (experiences)     |
| Budget advisory language             | `category-prompts.ts` (all categories)  |
| Zero results within budget           | `category-prompts.ts` (all categories)  |
| Level 4 warn-and-confirm             | `system-prompt.ts` (conditional)        |
| Preference-aware safety              | `trip-context.ts` or `system-prompt.ts` |
| Hotels "how many nights" for one-way | `category-prompts.ts` (hotels)          |
| Destination change warning           | `system-prompt.ts`                      |

### Frontend Changes

| Change                                | File(s)                                     |
| ------------------------------------- | ------------------------------------------- |
| Submitted form read-only              | `TripDetailsForm.tsx`                       |
| Past date disabled in picker          | `TripDetailsForm.tsx`                       |
| Trip type toggle (one-way/round-trip) | `TripDetailsForm.tsx`                       |
| Budget bar hidden when no budget      | `NodeRenderer.tsx` or `VirtualizedChat.tsx` |
