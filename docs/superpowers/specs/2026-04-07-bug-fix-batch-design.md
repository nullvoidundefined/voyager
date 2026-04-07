# 2026-04-07 Bug Fix Batch: NaN Budget, Car Rental Failure, Progress Bar, Pending Indicator, Spacing

## Context

Six user-reported bugs found while exercising the trip planner against a real Beijing trip on 2026-04-07. Each gets fixed test-first per the global rule: failing test, minimal fix, passing test, full verification chain, commit.

The bugs are independent enough that each gets its own commit (one commit per triage ID per the global "never batch unrelated bug IDs" rule).

## Bugs

### B1: Budget tile and Cost Breakdown render `$NaN`

**Severity:** P1 (visible production bug, breaks core trust signal)
**Effort:** S

**Symptom**

On `/trips/[id]`, with a flight and a hotel selected and no car rentals:

- Budget tile (top right of header) renders `$10,000` total but `$NaN allocated`.
- Cost Breakdown card renders `Flights $1,010`, `Hotels $1,105`, `Remaining $NaN`.

**Root cause hypothesis**

Two candidate causes, both plausible, fixed together:

1. `web-client/src/app/(protected)/trips/[id]/page.tsx:131` computes `carRentalTotal = trip.car_rentals.reduce((sum, c) => sum + c.total_price, 0)`. This is the only one of the four reduces missing a `?? 0`. If any car rental row has `total_price` null or undefined, NaN propagates into `allocated`, then into `remaining`.
2. `pg` returns Postgres `numeric` columns as JavaScript strings by default. So `0 + "150.00"` is `"0150.00"`, and downstream arithmetic produces NaN. This affects every numeric column in `trip_flights`, `trip_hotels`, `trip_car_rentals`, `trip_experiences`.

The fix targets the boundary (the repository) so the rest of the codebase can trust the types, plus a defensive `?? 0` on the frontend for the specific reduce that lacks it.

**Fix**

- In `server/src/repositories/trips/trips.ts`, after each `query<T>(...)` for the four detail tables, map the rows so `numeric` columns become `number | null` (using `Number()` and checking for `null`).
- In `web-client/src/app/(protected)/trips/[id]/page.tsx`, change `carRentalTotal` reduce to `(sum, c) => sum + (c.total_price ?? 0)`.
- Add a final `Number.isFinite(allocated) ? allocated : 0` guard before rendering, so any future regression cannot resurface NaN to the user.

**Tests**

1. **Server repository test** (extends existing `repositories/trips/trips.test.ts`): insert a trip with one car rental whose `total_price = 150.00`. Read it back via `getTripWithDetails`. Assert `typeof rentals[0].total_price === 'number'` and `rentals[0].total_price === 150`. This catches the pg-string-coercion class of bug for any future column added.
2. **Frontend component test** (new `web-client/src/app/(protected)/trips/[id]/page.test.tsx`): render the page with a fixture trip whose `car_rentals` row has `total_price: null`, `flights` and `hotels` populated with valid numbers. Assert the Budget tile shows `$0 allocated` and the Cost Breakdown "Remaining" shows a finite currency string, never `$NaN`.

### B2: Car rental search fails with "I'm having trouble accessing"

**Severity:** P1 (degrades core agent capability)
**Effort:** M

**Symptom**

Agent says "I'm having trouble accessing car rental search results right now" and falls back to generic prose suggestions. Means `search_car_rentals` tool threw an exception and the agent narrated around it.

**Root cause hypothesis**

`server/src/tools/car-rentals.tool.ts` calls `serpApiGet('google_car_rental', params)` and casts the response without a try/catch. Any SerpApi failure (engine not supported for the region, rate limit, network, malformed response) throws synchronously up to the executor, which surfaces it to the agent as a tool error. The agent then improvises the fallback prose seen in the screenshot.

The actual upstream cause for Beijing is likely that SerpApi's `google_car_rental` engine returns no results for some international IATA regions, or returns a different shape. We will:

1. Pull Railway logs to confirm the actual error string.
2. Make the tool resilient: catch SerpApi errors, return `{ rentals: [], error: '<short reason>' }` instead of throwing.
3. Update the tool description in `server/src/tools/definitions.ts` so the agent knows the "no rentals" result is a first-class outcome and should be narrated as "no car rentals available for this destination" rather than "having trouble accessing."

**Fix**

- Wrap the SerpApi call in `car-rentals.tool.ts` in try/catch. On error, log via `logger.warn` (not error) with the upstream error message, return `{ rentals: [], error: errorMessage }`.
- Change the return type of `searchCarRentals` to `{ rentals: CarRentalResult[]; error?: string }`.
- Update `server/src/tools/definitions.ts` `search_car_rentals` description to document the no-results path.

**Tests**

1. `server/src/tools/car-rentals.tool.test.ts`: mock `serpApiGet` to throw `new Error('SerpApi 500')`. Assert `searchCarRentals(input)` returns `{ rentals: [], error: 'SerpApi 500' }` and does not throw.
2. Same file: mock `serpApiGet` to return `{ cars_results: [] }`. Assert `searchCarRentals(input)` returns `{ rentals: [], error: undefined }` and does not throw.
3. Same file: mock `serpApiGet` to return a normal populated `cars_results`. Assert the existing happy path still passes (regression guard).

**Investigation step (not a test, run inline during fix):** `railway logs` filtered to the recent failed turn so the actual upstream error is logged in the BUG ticket and `docs/BUGS.md` for future reference.

### B3: ToolProgressIndicator looks broken (no gap, repetition)

**Severity:** P2 (visual quality, not broken functionality)
**Effort:** M

**Symptom**

The progress chips (`Finding experiences Done`, `Assembling response Done`) sit flush against each other with no gap, and each chip duplicates the label by also rendering the word "Done." Visually reads as broken UI.

**Root cause**

Each `tool_progress` node renders as its own chip via `ToolProgressIndicator.tsx`. The SCSS module sets no horizontal margin between adjacent wrappers and the chip itself prints both the tool label and a separate "Done" label, which compounds the busy look.

**Fix**

Replace the per-tool chip stack with a single consolidated `<ChatProgressBar>` rendered once per turn whenever any `tool_progress` nodes exist for that turn. Determinate progress fill = `done count / total count`. One text line below the bar showing the latest in-progress tool's label, e.g., "Searching flights…". When all tools in the turn are done, the bar reads 100% with the text "Done" for one render cycle, then gets cleaned up by the next turn boundary.

The data model does not change. `tool_progress` nodes are still appended to chat state. The ChatBox renderer collapses adjacent `tool_progress` nodes into one progress-bar render. This respects the ChatBox invariants rule (data model unchanged, only the render layer changes).

**Implementation sketch**

- New component: `web-client/src/components/ChatBox/widgets/ChatProgressBar.tsx` plus `.module.scss`.
- New helper in `web-client/src/components/ChatBox/NodeRenderer.tsx` (or wherever the node-to-render mapping lives): when iterating nodes, fold consecutive `tool_progress` nodes into one virtual `progress_group` render that mounts `<ChatProgressBar progress={done/total} latestLabel={...} />`.
- Delete `ToolProgressIndicator.tsx` and its SCSS once the new component is wired in.

**Tests**

1. New `ChatProgressBar.test.tsx`: render with `done=0, total=3, latestLabel="Searching flights"` and assert one `progressbar` role with `aria-valuenow=0`, one visible label "Searching flights…". Render with `done=2, total=3` and assert `aria-valuenow=66`. Render with `done=3, total=3` and assert "Done".
2. Extend `web-client/src/components/ChatBox/ChatBox.invariants.test.tsx` (the canonical invariants spec per CLAUDE.md) with one new invariant: "Multiple consecutive `tool_progress` nodes render as exactly one progress bar element, never N chips." This is the regression guard against future re-introduction of the chip stack.

### B4: Chat appears dead between submit and first stream chunk

**Severity:** P2 (UX confidence, not broken functionality)
**Effort:** S

**Symptom**

User sends a message. The user's message appears in the chat. Nothing else happens visually for several seconds (until the first SSE event). The chat looks dead. User does not know whether the request landed.

**Fix**

On `sendMessage`, immediately append a `pending` ephemeral indicator. Implementation: extend `<ChatProgressBar>` from B3 with an `indeterminate` mode (no fill percentage, animated shimmer) and render it with text "Thinking…". The first incoming SSE event of the turn removes the pending indicator. Once any `tool_progress` node arrives, the bar transitions from indeterminate "Thinking…" to determinate fill from B3 naturally.

The pending indicator is per-turn, ephemeral, and never persisted to the backend. It lives in the same chat node array as the typed nodes but is filtered out before any save / replay.

**Tests**

1. Extend `ChatBox.invariants.test.tsx`: simulate `sendMessage('plan a trip')` with a controllable mock SSE stream. Assert that synchronously after submit, a `pending` indicator with text "Thinking" exists in the DOM. Then resolve the first SSE event with a `text` node. Assert the `pending` indicator is gone and the `text` node is present.
2. Add it as a named invariant: "Pending indicator renders synchronously on send and disappears on first SSE event."

### B6: "Book This Trip" / "Try Again" buttons are huge and intrusive

**Severity:** P2 (visible, breaks polish, but functional)
**Effort:** M

**Symptom**

When a trip has at least one flight and is in `planning` status with no active selectable tiles, `ChatBox.tsx` renders two large stacked buttons (`Book This Trip` and `Try Again`) above the input. They are oversized, sit flush against the input with no gutter, and dominate the screen even though they are not the most important content.

**Fix**

Replace the sticky two-button bar with an inline assistant-style tile rendered at the end of the chat node stream. Per Q1 through Q4 brainstorm: client-rendered (not agent-emitted), styled like an assistant message with the VOYAGER sender label, single short body line, conditional quick-reply chips reflecting what is missing from the trip.

**Behavior**

- **Trigger:** same condition as today's `showBookingActions`: `hasFlights && tripStatus === 'planning' && !isSending && !hasActiveTileSelection`. Add: `hasHotels` (booking should not be offered before lodging exists).
- **Body copy:** `"Ready to book this trip, or want to keep refining?"` (no recap; the itinerary sections directly below the chat already show the trip contents).
- **Chips (conditional, all chip variants from existing `QuickReplyChips` component):**
  - `Book now` (primary, always shown). On click: calls existing `handleBookTrip`.
  - `Add experiences` (only if `trip.experiences.length === 0`). On click: sends "Can you suggest some experiences for this trip?" via `handleSend`.
  - `Add car rental` (only if `trip.car_rentals.length === 0`). On click: sends "Can you find a car rental for this trip?" via `handleSend`.
  - `Change something` (always shown). On click: sends today's existing "I'd like to make some changes to the itinerary. What would you suggest adjusting?" prompt via `handleSend`.
- **Dismissal:** the tile disappears as soon as `showBookingActions` flips false. That happens automatically when the user sends another message (re-enters the agent loop), books the trip (`tripStatus` becomes `saved`), or new selectable tiles appear.
- **Position:** rendered as the _last_ node in the chat stream, after all server messages and any in-flight streaming nodes. Visually it sits where any new agent message would arrive, so it doesn't fight the input.

**Implementation sketch**

- New virtual chat node type `booking_prompt` (client-only, never persisted, never sent to server). Purely a render hint.
- In `ChatBox.tsx`, when `showBookingActions` is true, append a single `booking_prompt` node to the message list passed to `<VirtualizedChat>`. Pass `experiencesEmpty` and `carRentalsEmpty` flags.
- New renderer: `web-client/src/components/ChatBox/nodes/BookingPrompt.tsx` plus SCSS module. Reuses the assistant-message wrapper styles so it visually matches a real agent message.
- Chips reuse the existing `QuickReplyChips` component for visual consistency.
- Delete the old `bookingActions`, `bookButton`, `tryAgainButton` blocks from `ChatBox.tsx` and `ChatBox.module.scss` once the new node is wired in.

**Tests**

1. New `BookingPrompt.test.tsx`: render with `experiencesEmpty=true, carRentalsEmpty=true` and assert all four chips appear in order. Render with `experiencesEmpty=false, carRentalsEmpty=true` and assert "Add experiences" is absent. Render with both false and assert only `Book now` and `Change something` appear.
2. Extend `ChatBox.invariants.test.tsx` with one new invariant: "BookingPrompt tile renders exactly once when booking criteria are met, and disappears when the user sends a message." Simulate the criteria being met, assert one BookingPrompt is in the DOM, simulate `handleSend`, assert the BookingPrompt is gone.
3. Click test: render with all chips, click each chip, assert the right callback is invoked (`handleBookTrip` for Book now, `handleSend` with the right prompt strings for the other three).

### B5: No gap between ChatBox and Flights section

**Severity:** P3 (cosmetic spacing)
**Effort:** S

**Symptom**

Visual: the Flights heading sits flush against the chat composer's send button. No vertical breathing room.

**Fix**

SCSS-only. In `web-client/src/app/(protected)/trips/[id]/page.module.scss`, add adequate `margin-top` to `.itinerary` (or equivalent) so the Flights / Hotels / Cost Breakdown sections sit clearly below the chat box.

**Tests**

Playwright snapshot test in `e2e/trip-page-spacing.spec.ts`: load a seeded trip with at least one flight, screenshot the region around the chat-section / itinerary boundary, compare against committed baseline. The snapshot is the regression guard. Use the existing seeded test database and Playwright config.

## Cross-cutting rules to honor

- **One commit per bug ID.** Six commits, one per B1 through B6. Subjects: `fix(B1): coerce trip detail numeric columns and guard NaN`, `fix(B2): make car rental tool fail soft`, `fix(B3): consolidate tool progress into one bar`, `fix(B4): show pending indicator before first stream chunk`, `fix(B5): add gap between chat box and itinerary sections`, `fix(B6): replace huge book buttons with inline assistant prompt tile`.
- **Test-first.** For each bug: write failing test, run, confirm RED, fix, run, confirm GREEN, run full verification chain `pnpm format:check && pnpm lint && pnpm test && pnpm build`, commit.
- **Commit must include the test and the fix in the same diff.** No separate "add test" commit.
- **Pre-push hook is the only review boundary.** Do not bypass.
- **No em dashes** anywhere in code, comments, prompts, or commit messages.
- **Update `docs/BUGS.md`** with B1 through B6 entries tagged `severity: Px` and `effort: S|M|L` per the docs/BUGS.md severity tagging rule. P0/P1 entries (B1, B2) get mirrored into `docs/audits/2026-04-07-triage.md`.

## Order of work

1. B1 first (highest visibility, smallest blast radius, sets up component test scaffolding the others reuse).
2. B2 second (depends on `car-rentals.tool.ts`, no UI dependencies).
3. B3 third (introduces `ChatProgressBar`, which B4 reuses).
4. B4 fourth (depends on `ChatProgressBar` if we choose the indeterminate-shimmer variant, otherwise standalone).
5. B6 fifth (touches `ChatBox.tsx`, depends on understanding the existing booking actions code path and the QuickReplyChips component, no other dependencies).
6. B5 last (visual, lowest priority, Playwright snapshot baseline lands clean once the rest is in including B6 since the new BookingPrompt tile changes what is on screen near the chat-itinerary boundary).

## Out of scope

- Refactoring the chat node data model.
- Changing the agent system prompt beyond the one-line `search_car_rentals` description update for B2.
- Any non-spacing styling changes to the trip detail page.
- Any non-NaN bug discovered during implementation. Those go to `docs/BUGS.md` for a future batch.
