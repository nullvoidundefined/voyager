# Design: The Concierge Learns to Graze (Chat Discovery, Phase 1)

Date: 2026-07-06
Status: Design, pending user review. Validated against the finished multi-modal-journeys architecture at `origin/main` `bfd055a`.
Worktree: `explore-discovery-brainstorm`, fast-forwarded to `bfd055a`.
Supersedes: `2026-07-05-discovery-layer-notes.md` and the two earlier drafts of this file.

## Goal

Voyager is a portfolio demo of the ability to build a genuinely complicated chatbot. Today that chatbot assumes you already know where you are going. This phase gives the concierge a second gear, discovery, expressed entirely inside the same conversation (Option 2: the chatbot itself is the grazing engine, not a separate browse UI). It helps a user who does not yet have a destination, answers open-ended curiosity with rich in-chat cards, and pivots the same thread into the existing planning flow. The chat is the protagonist throughout; grazing is the appetizer.

## Foundation: the multi-modal-journeys refactor (now final)

A concurrent refactor ("Multi-Modal Journeys & Self-Enriching Inventory," `docs/specs/2026-07-05-multimodal-journeys.md`) is complete and pushed to `origin/main` (`bfd055a`). It is the foundation this builds on. It replaced the four-fixed-category booking funnel with a segment-capability registry and journey-type registry, collapsed all tiles into one `offer_tiles` node, and added an `inventory_items` knowledge base with a cold-to-warm search path (structured API, knowledge-base write-back, gated web discovery). It does NOT cover destination discovery: it infers travel mode and enriches transport/lodging inventory; it never helps an undecided traveler pick a place. Discovery fills that gap and rides these rails.

Verified contracts (read from `bfd055a`):

- `packages/types/src/segments.ts`: `SEGMENT_KINDS = ['flight','hotel','car_rental','experience']`; `OfferKind = SegmentKind`; `Offer` = `{ id, title, subtitle?, image_url?, price, currency, price_unit?, badges?, detail?, booking_url?, lat?, lon? }`.
- `packages/types/src/nodes.ts`: the only tile node is `{ type: 'offer_tiles'; offer_kind: OfferKind; offers: Offer[]; selectable: boolean }`.
- `apps/server/src/segments/segmentCapability.ts`: a `SegmentCapability` is booking-shaped (searchTool, selectTool, resultListKey, toOffer, planCategoryId, subAgentTools, requiredTools) and now also `buildSearchKeys` (derives KB `region`/`routeKey`) and optional `webDiscovery.buildQuery`. All region/route-keyed. A destination has no region key by nature (region is the answer, not the query), which confirms a destination is not a SegmentCapability.
- `apps/server/src/prompts/bookingSteps.ts`: `FlowPosition = COLLECT_DETAILS | PLAN_TRIP | PLANNING | COMPLETE`. `getFlowPosition` gates `COLLECT_DETAILS` on `origin`/dates and never checks destination. Insertion point for discovery is here.
- `apps/server/src/segments/runSegmentSearch.ts`: cold-to-warm path keyed by `kind + region`; serves KB rows via `findInventoryItems({ kind, region, routeKey })`. Attribute-first destination-finding does not fit this shape.
- `apps/client/web/src/components/ChatBox/nodes/offerCardRegistry.tsx`: `OFFER_CARD_REGISTRY: Partial<Record<OfferKind, OfferCardEntry>>` with a `FallbackOfferCard`. Adding a kind adds one entry; `NodeRenderer`/`VirtualizedChat` never grow per-mode logic.
- `apps/server/src/prompts/systemPrompt.ts` core prompt now bans unbacked price estimates; discovery must honor this.

## Decisions locked (brainstorm 2026-07-05 to 2026-07-06)

1. Center of gravity: planner-first, richer discovery. Discovery serves and funnels into the chat.
2. Ambition: portfolio demo, chat-first. Not a live product. Keep the demo framing. Memory `project_portfolio_demo_chat_first`.
3. Mechanic: Option 2. The chatbot is the discovery engine; no separate browse UI.
4. Grounding: blend. Destination-finding is curated; in-place curiosity goes live via Google Places (`search_experiences`); SerpApi stays out of discovery.
5. Sequencing: build against the finished foundation. Two edits touch central shared files (flagged below); everything else is additive.

## Target: four moves

### Move 1: `discover_destinations` tool (server, additive)

A new tool that answers "somewhere warm and cheap in February." It reads the curated catalog (`apps/server/src/data/destinations.json`, ~30 places) directly and ranks/filters by soft criteria, returning the top handful. No KB, no region key, no network: deterministic and free. (The KB is a possible future convergence path if destinations ever get web-enriched, but it is region-keyed and does not fit attribute-first destination-finding, so Phase 1 reads the catalog directly.)

Input schema (Zod, derived into the model-facing definition per the tool registry pattern): `vibes?: string[]` (catalog category vocabulary), `max_price_level?: 1|2|3|4`, `max_daily_budget_usd?: number`, `month?: string`, `climate?: 'warm'|'mild'|'cold'`, `region?: string`, `limit?: number` (default 5).

Output: an `offer_tiles` node with `offer_kind: 'destination'`, `selectable: true`. Ranking and the destination-to-Offer mapping are pure, testable functions. Cards carry curated daily-budget ranges labeled as estimates, never invented prices (honors the core prompt's no-unbacked-price rule).

### Move 2: the `destination` offer-kind (shared types + client, CENTRAL EDIT #1)

`OfferKind` is currently aliased to `SegmentKind`, so a destination tile cannot exist without implying a bookable segment. Change:

- In `packages/types/src/segments.ts`, decouple the offer vocabulary from the bookable-segment vocabulary: `export type OfferKind = SegmentKind | 'destination';`. This lets a non-bookable `offer_tiles` variant exist with no `SegmentCapability`, select tool, repository, or plan-card category. It forces no new segment registration: the segment-capability registry enumerates only real segments, and `buildOfferTilesNode` is driven by search tools, which destination bypasses.
- Client: add one `OFFER_CARD_REGISTRY['destination']` entry, a `DestinationOfferCard` (image, name as title, country as subtitle, vibe tags and best-season as badges, a one-line hook), with a `selectionMessage` that reads as a planning commit ("Let's plan a trip to {name}"). Additive to a registry that already has a fallback.

This is a small edit to a central shared-types file; call it out in review because it widens a core union.

### Move 3: the `DISCOVER` phase (server flow, CENTRAL EDIT #2)

`getFlowPosition` never checks for a destination. Add a `DISCOVER` phase ahead of `COLLECT_DETAILS`:

- Add `{ phase: 'DISCOVER' }` to the `FlowPosition` union.
- At the top of `getFlowPosition`, before the origin/dates gate: if the trip has no destination set, return `{ phase: 'DISCOVER' }`. (Confirm the exact field, expected `trip.destination`.)
- Add a `DISCOVER` prompt addendum in `systemPrompt.ts` (mirroring the existing `COLLECT_DETAILS`/`COMPLETE` addenda): in this phase the agent does not present the details form; it answers curiosity, calls `discover_destinations`, and calls `search_experiences` for live in-place richness; it nudges toward planning only once the user is warm.

This sits upstream of journey selection (you cannot infer flight-vs-cruise before there is a place) and is forward-compatible with the refactor's planned Phase 5 conversational journey inference. It is additive: it does not alter `COLLECT_DETAILS`, `PLAN_TRIP`, `PLANNING`, or `COMPLETE`.

### Move 4: the pivot and the live blend

Pivot: selecting a destination tile emits the registry `selectionMessage` ("Let's plan a trip to {name}"), which the agent reads as a commit: it seeds the destination into trip state, `getFlowPosition` advances past `DISCOVER`, and the existing journey flow (today `flight_trip`) takes over. One conversation, both modes. This is the demo's signature moment.

Live blend: destination-finding is curated (Move 1); in-place curiosity ("good restaurants in Lisbon", "what is worth doing here") calls the existing `search_experiences` tool, which already emits `offer_tiles` of `offer_kind: 'experience'` and rides the segment cold-to-warm path and cache. No new card is needed for those. SerpApi (flights/hotels, scarce 250/month) is never called in discovery; Google Places is the live source discovery leans on.

## Build plan (all buildable now against `bfd055a`)

Additive (low blast radius):

- `discover_destinations` ranking/mapping as pure functions, with a fixture test over the real catalog (warm-cheap-February returns plausible results; empty-result path; a negative/contradictory-input test per the input-handler rule).
- The `DestinationOfferCard` component and its offer-card-registry entry, with component tests driven by mock `offer_tiles` nodes of `offer_kind: 'destination'`.

Central edits (small, but they touch shared/core files, so review deliberately):

- Move 2: widen `OfferKind` in `packages/types/src/segments.ts`.
- Move 3: the `DISCOVER` phase in `bookingSteps.ts` and its prompt addendum in `systemPrompt.ts`, plus the pivot's destination seed.

## Testing

- `discover_destinations`: fixture test over the real catalog; ranking assertions; empty and malformed-input paths.
- `DestinationOfferCard`: component test via mock `offer_tiles` nodes; select fires the planning-commit message.
- Flow: `getFlowPosition` returns `DISCOVER` when destination is absent and is unchanged otherwise (regression baseline against the existing phases); the pivot seeds the destination and advances to `COLLECT_DETAILS`/journey flow.
- ChatBox invariants: extend `apps/client/web/src/__tests__/components/ChatBox/ChatBox.invariants.test.tsx` (the refactor moved it under `__tests__/`) with a destination-tiles-persist invariant. Do not create a new ad-hoc test file (repo rule).
- No-fabrication: assert discovery presents only curated fields and labels budgets as estimates.

## Out of scope (YAGNI)

Editorial feed pages, map-first browsing, a persisted taste/personalization model, live data in destination-finding, seeding destinations into the inventory KB, a landing-page overhaul, any new browse route, and registering `destination` as a bookable `SegmentCapability`. The static `/explore` pages remain as-is.

## Two edits to shared/core files (call out in review)

1. `OfferKind = SegmentKind | 'destination'` in `packages/types/src/segments.ts`. A non-bookable offer kind that needs no `SegmentCapability`; verify it breaks no exhaustiveness assumptions in the segment registry or offer-card resolution.
2. A `DISCOVER` phase in `getFlowPosition` / `FlowPosition` and its `systemPrompt.ts` addendum, gated on absence of a destination. Confirm the destination field on `TripState` and that no existing phase behavior shifts.

## Risks

- The ~30-destination catalog bounds discovery breadth; answers feel curated, not encyclopedic. Acceptable for a demo; catalog expansion is a later effort.
- Google Places cost in discovery is bounded by the existing cache and the segment cold-to-warm path, keyed by place and query.
- Widening `OfferKind` is a one-line change with wide type reach; the type checker will surface any consumer that assumed `OfferKind === SegmentKind`. Treat any such site as part of Move 2.
