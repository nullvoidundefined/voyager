# Spec: Multi-Modal Journeys & Self-Enriching Inventory

**Status:** Draft for review
**Date:** 2026-07-05
**Scope:** Server (`apps/server`), shared types (`packages/types`), web client (`apps/client/web`), Postgres migrations
**Related:** `docs/FULL_APPLICATION_SPEC.md`, `docs/SUGGESTED_FEATURES.md`, `CLAUDE.md`

---

## 1. Goal & non-goals

### Goal

Turn Voyager from a flight-centric planner into a system that can plan and book a **wide variety of journeys** — a road trip, a flight-based trip, a cruise, a luxury rail journey, or a multi-modal itinerary that combines them — while keeping the code clean and extensible. Journey type is **inferred conversationally** from the user's description; no upfront mode picker.

Add a **self-enriching inventory knowledge base**: the first time a user asks for a niche journey (e.g., a luxury Romanian train), the agent searches the web; the normalized results are persisted and reused, so over time Voyager assembles a durable, region-indexed catalog of transport options and gets faster and richer without repeat live searches.

### Non-goals

- No real payment/booking execution (unchanged — Voyager surfaces booking URLs, it does not transact).
- No change to the auth, billing, or deployment model.
- No new external paid API tiers required beyond existing SerpApi + Google Places + web search. New segment providers should degrade gracefully to web search + the knowledge base.
- Not a UI reskin. The visual language (tiles, plan card, budget bar) is reused, generalized rather than replaced.

---

## 2. Why this needs a refactor, not just new tools

The current design assumes exactly four fixed categories in a fixed order: **flights → hotels → experiences → car rental**. That assumption is hardcoded in **six** places, and adding cruises/trains/road-trips by copy-paste would multiply each of them — the definition of the spaghetti we're avoiding.

| #   | Site                                                                                                         | Hardcoded assumption                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `apps/server/src/prompts/bookingSteps.ts`                                                                    | `CategoryName = 'flights' \| 'hotels' \| 'car_rental' \| 'experiences'`; `CompletionTracker` has one named field per category; `SEARCH_TOOLS`, `SELECTION_KEYS`, `SELECT_TOOLS`, `CATEGORIES` all enumerate the four; `transport` is only `'flying' \| 'driving'`. |
| 2   | `apps/server/src/services/agent/subAgentService.ts`                                                          | `SUB_AGENT_TOOLS`/`SUB_AGENT_REQUIRED_TOOLS` keyed by fixed sub-agent names; `selectSubAgent()` encodes the flight→hotel→experience→ground order as `if` branches; `buildDefaultPlanCard()` hardcodes the four categories.                                         |
| 3   | `apps/server/src/prompts/systemPrompt.ts`                                                                    | The "STRICT Presentation Order: one category per turn" prose block enumerates flights first, hotels second, etc.                                                                                                                                                   |
| 4   | `apps/server/src/types/planCard.ts`                                                                          | `TripPlanCategoryId` union of the four categories.                                                                                                                                                                                                                 |
| 5   | `packages/types/src/nodes.ts`                                                                                | Per-category tile nodes (`flight_tiles`, `hotel_tiles`, `car_rental_tiles`, `experience_tiles`); **duplicate** `TripPlanCard`/`TripPlanCategoryId` definitions (also in site 4).                                                                                   |
| 6   | `apps/server/src/tools/registry/toolRegistry.ts` + `apps/client/web/src/components/ChatBox/NodeRenderer.tsx` | Flat tool list and a per-tile-type `switch` that grows by one arm per new mode.                                                                                                                                                                                    |

**The seam already exists.** Migrations `1779889817692_create-trip-legs.js` and the `trip_transport` table already model a journey as an ordered list of **legs**, each carrying a transport row whose `type` is one of `flight | road_trip | cruise | train`. The database anticipated multi-modal travel; the agent and UI layers never caught up to it. This spec makes the agent/UI layers use that seam and generalizes the six hardcoded sites behind two registries.

---

## 3. Target architecture

Two new registries plus one new persistence subsystem. Everything else is generalization of existing code.

### 3.1 Core idea: a _Segment_ is the unit of planning

Every bookable thing — a flight, a hotel, a rental car, an experience, a cruise, a train journey, a road-trip route — is a **segment**: something the agent can _search_, _present as tiles_, let the user _select_, that _contributes to the budget_ and _reports a completion status_. The current code hand-writes each of these five behaviors per category. We collapse them behind a **segment capability descriptor**, so adding a mode is registering data, not threading a new special case through six files.

```ts
// apps/server/src/segments/segmentCapability.ts  (NEW)
export interface SegmentCapability {
  kind: SegmentKind; // 'flight' | 'hotel' | 'cruise' | 'train' | ...
  label: string; // 'Flight', 'Cruise', 'Luxury Rail'
  searchTool: string; // registry tool name, e.g. 'search_cruises'
  selectTool: string; // e.g. 'select_cruise'
  tileKind: OfferKind; // discriminant for the generic offer_tiles node
  repository: SegmentRepository; // insert/list/costs for this segment's table
  budget: (offer: Offer) => number; // how an offer contributes to spend
  provider: SegmentProvider; // how to source offers (see 3.4)
  /** Segments that must be resolved before this one can be worked, expressed
   *  in terms of *roles*, not concrete kinds, so journeys stay composable. */
  requires?: SegmentRole[]; // e.g. cruise requires ['arrival_at_port']
}
```

`SegmentKind` is an open string-literal union in `packages/types`. A new mode adds one member and one `SegmentCapability` registration — the compiler's exhaustiveness checks then point at every place that must handle it.

### 3.2 A _Journey Type_ composes segments into an ordered flow

The hardcoded ordering in `selectSubAgent()` and the "STRICT Presentation Order" prose both become **data** owned by a journey-type descriptor:

```ts
// apps/server/src/journeys/journeyType.ts  (NEW)
export interface JourneyType {
  id: JourneyTypeId; // 'flight_trip' | 'road_trip' | 'cruise' | 'rail_journey' | 'multi_modal'
  label: string;
  /** Ordered segments for this journey. Order drives both the plan card and the
   *  one-segment-per-turn presentation sequence. */
  segments: SegmentSlot[];
  /** Natural-language cues the classifier uses for conversational inference. */
  inferenceHints: string[];
}

export interface SegmentSlot {
  kind: SegmentKind;
  defaultEnabled: boolean;
  optional: boolean; // can be skipped/omitted for this journey
  notApplicableWhen?: (trip: TripState) => string | undefined; // returns reason
}
```

Examples (each is a data literal in `apps/server/src/journeys/definitions/`):

- **`flight_trip`** — `[flight, hotel, car_rental?, experiences]` (today's flow, now expressed as data).
- **`road_trip`** — `[road_route, car_rental?, hotel(s), experiences]`; flights `not_applicable`.
- **`cruise`** — `[flight?(to embark port), cruise, hotel?(pre/post), experiences(shore excursions)]`.
- **`rail_journey`** — `[flight?(to origin city), train, hotel?, experiences]`.
- **`multi_modal`** — leg-driven: the journey is a sequence of legs, each leg picks its own transport segment (see 3.5).

### 3.3 Generalized flow state

`CompletionTracker`'s four named fields become a keyed map derived from the active journey's segment list:

```ts
// apps/server/src/prompts/bookingSteps.ts  (CHANGED)
export interface CompletionTracker {
  version: number; // bump to 4
  journeyType: JourneyTypeId; // NEW: which journey we're planning
  segments: Record<SegmentKind, TrackerStatus>; // replaces flights/hotels/car_rental/experiences fields
  plan_confirmed: boolean;
  segment_interests: Record<SegmentKind, string[]>; // generalizes experience_interests
  turns_since_last_progress: number;
}
```

`SEARCH_TOOLS`, `SELECTION_KEYS`, `SELECT_TOOLS`, and the `CATEGORIES` array are **deleted** and replaced by lookups over the segment-capability registry keyed by the active journey's segments. `selectSubAgent()` becomes: _find the first segment slot in journey order whose status `needsWork` and whose `requires` roles are all resolved._ The four-way `if` ladder disappears.

`normalizeCompletionTracker()` gains a **v3 → v4 migration** that maps the old named fields into `segments` under `journeyType: 'flight_trip'`, preserving every in-flight trip. (Same pattern as the existing v1→v3 migration already in this file.)

### 3.4 Generalized presentation and tiles

**Server side.** The "STRICT Presentation Order" prose is generated from the active journey's segment order rather than written by hand:

```ts
// systemPrompt.ts (CHANGED) — buildPresentationOrder(journey, tracker)
// emits "Present <segment.label> first … then <next> …", numbered from journey.segments,
// keeping the existing one-selectable-set-per-turn invariant intact.
```

**Client side.** The per-category tile nodes collapse into one generic node with a discriminated payload, so `NodeRenderer` stops growing an arm per mode:

```ts
// packages/types/src/nodes.ts (CHANGED)
export interface Offer {
  id: string;
  title: string; // 'JetBlue B6 75', 'Venice Simplon-Orient-Express'
  subtitle?: string; // route / provider / class
  image_url?: string;
  price: number;
  currency: string;
  price_unit?: 'total' | 'per_night' | 'per_day' | 'per_person';
  badges?: string[]; // ['Balcony cabin', '7 nights', 'Automatic']
  detail?: Record<string, string | number>; // kind-specific fields for the card
  booking_url?: string;
  lat?: number;
  lon?: number;
}

export type ChatNode =
  | { type: 'text'; content: string; citations?: Citation[] }
  | {
      type: 'offer_tiles';
      offer_kind: OfferKind;
      offers: Offer[];
      selectable: boolean;
    } // REPLACES the 4 *_tiles nodes
  | { type: 'travel_plan_form'; fields: FormField[] }
  | { type: 'itinerary'; days: DayPlan[] }
  | {
      type: 'advisory';
      severity: 'info' | 'warning' | 'critical';
      title: string;
      body: string;
    }
  | { type: 'weather_forecast'; forecast: WeatherDay[] }
  | { type: 'budget_bar'; allocated: number; total: number; currency: string }
  | { type: 'quick_replies'; options: string[] }
  | {
      type: 'tool_progress';
      tool_name: string;
      tool_id: string;
      status: 'running' | 'done';
    }
  | { type: 'plan_card'; plan_card: TripPlanCard; confirmed?: boolean };
```

`NodeRenderer` gets **one** `offer_tiles` case that delegates to a client-side card registry:

```ts
// apps/client/web/src/components/ChatBox/nodes/offerCardRegistry.ts (NEW)
export const OFFER_CARD_REGISTRY: Record<OfferKind, OfferCardComponent> = {
  flight: FlightCard,
  hotel: HotelCard,
  car_rental: CarRentalCard,
  experience: ExperienceCard,
  cruise: CruiseCard,
  train: TrainCard,
  road_route: RouteCard,
};
```

Existing `FlightCard`/`HotelCard`/`CarRentalCard` components are kept and adapted to the `Offer` shape; only the _container_ (`FlightTiles`, `HotelTiles`, …) collapses into one `OfferTiles` that reads the registry. This is the key anti-spaghetti move: **N growing switches become one registry lookup.**

### 3.5 Multi-modal branching via legs

For journeys that combine modes, the **leg** is the branch point (tables already exist: `trip_legs`, `trip_transport`). A journey is an ordered list of legs; each leg resolves one _transport_ segment (flight, train, cruise, road_route) plus optional per-leg lodging/experiences. The `add_leg`/`remove_leg`/`reorder_legs` tools already exist and are already reachable from the `flight` and `conversation` sub-agents — we generalize their sub-agent so any transport segment can populate a leg, and the plan card renders a **leg strip** for multi-modal journeys. Single-mode journeys keep a single implicit leg and never show the strip, so simple trips stay simple.

### 3.6 Conversational journey inference (no mode picker)

A lightweight classification step runs in the existing `plan` phase. Rather than a new model call, extend the **plan sub-agent**: it already builds a plan card; it now also emits `journey_type` via `update_trip`. Inference uses `JourneyType.inferenceHints` in the plan prompt ("cruise", "sail", "at sea" → `cruise`; "drive", "road trip", "rent a car and" → `road_trip`; "sleeper train", "rail journey", "Orient Express" → `rail_journey`; combinations → `multi_modal`). If ambiguous, the plan card offers a one-tap `quick_replies` disambiguation ("Is this a cruise or a flight + hotel trip?") instead of blocking. Journey type is stored on `trips.journey_type` and is revisable in conversation (changing it re-derives the tracker's segment map, warning before clearing incompatible selections — reusing the existing destination-change confirmation pattern).

---

## 4. Self-enriching inventory knowledge base

This is a **durable, curated store of transport/lodging options indexed by kind + region/route**, distinct from the existing Redis SerpApi cache. Redis is a short-TTL (6h) exact-key cache of raw API responses; the knowledge base is a long-lived, normalized, confidence-scored catalog that _accumulates_ across users and gets better with use.

### 4.1 Lookup path (cold → warm)

When a segment provider (say `search_trains` for "luxury Romania") runs:

1. **Redis exact-key cache** — unchanged, handles identical repeat queries within hours.
2. **Knowledge base** (`inventory_items`) — query by `kind`, `region`/`route`, and normalized attributes. If fresh, confident matches exist, return them (optionally topped up by a light live check). This is the "second time is fast and rich" path.
3. **Cold path — web search** — when the KB has too few/stale matches for the region, run `WebSearch`/`web_fetch` (and any structured provider that exists) to discover operators, routes, and indicative prices. Normalize into `Offer` shape.
4. **Write-back** — persist newly discovered offers into `inventory_items` with `source`, `confidence`, `first_seen_at`, `last_verified_at`, and provenance URLs, so the next lookup for that region is warm.

### 4.2 Schema (new migration)

```sql
-- migrations/<ts>_create-inventory-items.js  (NEW)
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(24) NOT NULL,              -- 'train' | 'cruise' | 'road_route' | 'flight' | 'hotel' | ...
  region VARCHAR(120) NOT NULL,           -- normalized region/country, e.g. 'romania'
  route_key VARCHAR(200),                 -- normalized origin→destination or loop key, nullable
  title TEXT NOT NULL,
  provider TEXT,
  attributes JSONB NOT NULL DEFAULT '{}', -- class, duration, cabin grades, indicative price band, etc.
  indicative_price NUMERIC(10,2),
  currency TEXT,
  booking_url TEXT,
  source VARCHAR(24) NOT NULL,            -- 'web_search' | 'serpapi' | 'curated' | 'provider_api'
  provenance JSONB NOT NULL DEFAULT '[]', -- source URLs + fetch timestamps
  confidence REAL NOT NULL DEFAULT 0.4,   -- 0..1; raised on repeat corroboration, lowered when stale
  hit_count INTEGER NOT NULL DEFAULT 0,   -- surfaced-to-user counter, for ranking/pruning
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX inventory_items_lookup ON inventory_items (kind, region, route_key);
CREATE UNIQUE INDEX inventory_items_dedupe ON inventory_items (kind, region, coalesce(route_key,''), md5(lower(title)));
```

### 4.3 Freshness, trust, and safety

- **Freshness policy per kind.** Prices are treated as _indicative_ with a `last_verified_at` staleness window (e.g. rail/cruise operators change seasonally, not hourly). Stale rows are re-verified on next surfacing, not blindly served. The UI labels KB-sourced prices as "from ~X" to set expectations, and live-verifies the specific selection before showing a booking URL.
- **Confidence scoring.** A row corroborated by multiple independent sources or repeatedly selected gains confidence; a row that fails re-verification loses it and is eventually pruned. Ranking prefers high-confidence, recently-verified rows.
- **Never fabricate.** Same rule as today's system prompt: the agent presents only what a provider or the KB returned. Web-search discoveries carry provenance URLs so claims are traceable (the existing `Citation` node type surfaces them).
- **Poisoning resistance.** Write-back is server-side and normalized; the model cannot write arbitrary rows — it can only trigger a provider that validates and inserts. Sources are allowlisted the way `WebFetch`/`WebSearch` already are.

### 4.4 Provider abstraction

Each `SegmentCapability.provider` implements the same interface so the cold→warm path is written once, not per mode:

```ts
// apps/server/src/segments/segmentProvider.ts (NEW)
export interface SegmentProvider {
  /** Structured API first (if the mode has one), else undefined → fall through. */
  fromApi?(input: SegmentSearchInput): Promise<Offer[] | undefined>;
  /** Cold-path discovery via web search; returns normalized offers + provenance. */
  fromWeb(input: SegmentSearchInput): Promise<DiscoveredOffer[]>;
}
// The KB read, Redis cache, write-back, confidence update, and budgeting are
// handled by a shared runSegmentSearch() wrapper so no provider re-implements them.
```

Flights/hotels keep their SerpApi `fromApi`; cruises/trains/road-routes start web-first and accumulate a KB, adding a structured `fromApi` later without touching callers.

---

## 5. Data model changes (migrations)

Follow the existing numbered-migration convention (`node-pg-migrate`, timestamp-prefixed filenames in `apps/server/migrations/`). One migration per concern; never edit a shipped migration.

1. `add-journey-type-to-trips` — `ALTER TABLE trips ADD COLUMN journey_type VARCHAR(24) DEFAULT 'flight_trip'`. Backfill existing rows: `driving` transport_mode → `road_trip`, else `flight_trip`.
2. `create-inventory-items` — §4.2.
3. `create-trip-cruises`, `create-trip-trains`, `create-trip-road-routes` — per-segment selection tables mirroring `trip_flights`/`trip_car_rentals` (including the `selection_key` unique-dedupe column added by `1779970910000_add-selection-key-dedupe.js`, and `booking_url` per `1779892700000`).
4. `generalize-trip-transport-usage` — no schema change; ensure `trip_transport.type` accepts the full `SegmentKind` set (already `VARCHAR(20)`), and add an index on `(leg_id, type)`.

The `CompletionTracker` v3→v4 change is a **code** migration inside `normalizeCompletionTracker()` (booking_state JSONB), not a DB migration — consistent with how the tracker is versioned today.

---

## 6. File-by-file change plan

### Shared types (`packages/types/src/`)

- `nodes.ts` — replace the four `*_tiles` nodes with the single `offer_tiles` node + `Offer`/`OfferKind` (§3.4). **Remove the duplicated `TripPlanCard`/`TripPlanCategoryId`** and re-export the canonical definition (see next bullet). Add `SegmentKind`, `JourneyTypeId`.
- `planCard.ts` (server) → **move** the canonical `TripPlanCard` types into `packages/types` so client and server share one definition; server imports from `@repo/types`. Generalize `TripPlanCategoryId` to `SegmentKind`.
- `events.ts` — no shape change; `offer_tiles` flows through the existing `{ type: 'node'; node }` SSE event, so **the API contract is unchanged** apart from the node payload. Client and server ship together, so no version skew.

### Server (`apps/server/src/`)

- `segments/` **(NEW dir)** — `segmentCapability.ts`, `segmentProvider.ts`, `runSegmentSearch.ts` (KB+cache+web-fallback+write-back wrapper), `registry/` with one file per capability (`flight.ts`, `hotel.ts`, `carRental.ts`, `experience.ts`, `cruise.ts`, `train.ts`, `roadRoute.ts`).
- `journeys/` **(NEW dir)** — `journeyType.ts`, `definitions/*.ts`, `inferJourneyType.ts` helpers + hints.
- `prompts/bookingSteps.ts` — generalize `CompletionTracker` to segment map (§3.3); add v3→v4 migration; delete `CategoryName`/`SEARCH_TOOLS`/`SELECTION_KEYS`/`SELECT_TOOLS`/`CATEGORIES` in favor of registry lookups.
- `services/agent/subAgentService.ts` — `selectSubAgent()` becomes journey-order-driven; `SUB_AGENT_TOOLS` derived from the active journey's segment capabilities rather than hand-written; `buildDefaultPlanCard()` built from the journey definition.
- `prompts/systemPrompt.ts` — replace the static "STRICT Presentation Order" block with `buildPresentationOrder(journey, tracker)` (§3.4).
- `tools/registry/` — add `searchCruises.ts`/`selectCruise.ts`, `searchTrains.ts`/`selectTrain.ts`, `searchRoadRoute.ts`/`selectRoadRoute.ts` following the existing `searchFlights.ts`/`selectFlight.ts` `ToolModule` pattern (Zod schema is source of truth; `deriveDefinition` keeps model JSON schema in sync). Register in `toolRegistry.ts`.
- `tools/executor.ts` — new `case`s dispatch to `runSegmentSearch(capability, input)` and the segment repositories; keep the existing per-tool Zod validation and `ToolAdapters` seam for E2E mocking.
- `repositories/trips/` — add `cruises.ts`, `trains.ts`, `roadRoutes.ts` and an `inventory.ts` repository (read/write-back/confidence update). Extend `getActualCostsForTrip()` to sum the new tables (keeps the P1-03 "DB is budget source of truth" rule intact).

### Client (`apps/client/web/src/components/ChatBox/`)

- `nodes/OfferTiles.tsx` **(NEW)** — generic container replacing `FlightTiles`/`HotelTiles`/`CarRentalTiles`/`ExperienceTiles`; reads `offerCardRegistry` and wraps them in the existing `widgets/SelectableCardGroup`.
- `nodes/offerCardRegistry.ts` **(NEW)** — kind → card component map.
- `widgets/CruiseCard.tsx`, `widgets/TrainCard.tsx`, `widgets/RouteCard.tsx` **(NEW)** — presentational cards alongside the existing `widgets/FlightCard.tsx`, `widgets/HotelCard.tsx`, `widgets/ExperienceCard.tsx` (and `nodes/CarRentalCard.tsx`), all adapted to the `Offer` shape.
- `NodeRenderer.tsx` — replace four tile cases with one `offer_tiles` case.
- `VirtualizedChat.tsx` — replace the four per-tile height estimates with one `offer_tiles` estimate keyed by `offer_kind`.
- `widgets/` plan card — render a **leg strip** when `journey_type === 'multi_modal'`; unchanged for single-mode journeys.
- `useSSEChat.ts` — no structural change (still consumes `node` events); confirm callbacks generalize to `onConfirmOffer(kind, offer)`.

---

## 7. Rollout plan (phased, one concern per commit)

Per `CLAUDE.md`: trunk-based, push to `main`, **one commit per triage/work item**, separate commits for unrelated changes, each commit self-contained with its test. Track the work items in `docs/todos/` by severity.

**Phase 0 — Groundwork, zero behavior change.**
0a. Move `TripPlanCard` types into `packages/types`, delete the duplicate, re-point imports.
0b. Introduce `SegmentKind`/`OfferKind` and the `Offer` type; add `offer_tiles` node **alongside** the existing tile nodes (not yet emitted).
0c. **Create** `ChatBox.invariants.test.tsx` (it does not exist yet — §8), encoding the invariants `CLAUDE.md` already requires, so every later phase extends one file instead of forking.

**Phase 1 — Generalize the flow engine behind `flight_trip` only.**
1a. `CompletionTracker` → segment map + v3→v4 migration; prove parity with a migration test over real `booking_state` fixtures.
1b. Segment-capability + journey-type registries, with only the four existing segments and `flight_trip` registered. `selectSubAgent()` and the presentation-order prompt now read the registry. **No user-visible change** — this is the risky refactor, gated by the existing E2E suite (`ToolAdapters` mocks) plus the ChatBox invariants spec.

**Phase 2 — Collapse the UI onto `offer_tiles`.**
Emit `offer_tiles` from the server, switch `NodeRenderer`/`VirtualizedChat` to the card registry, adapt the four existing cards to `Offer`, delete the old tile nodes/containers. Still four modes, still identical UX.

**Phase 3 — Inventory knowledge base.**
`create-inventory-items` migration, `inventory` repository, `runSegmentSearch()` cold→warm path with web-search fallback + write-back + confidence scoring. Wire it under the existing four modes first (they get a KB backstop when SerpApi quota is exhausted — a real robustness win given the 250-search/month free tier noted in `CLAUDE.md`).

**Phase 4 — New modes, one journey per commit.**
`road_trip`, then `cruise`, then `rail_journey`. Each adds: capability registration, tool schema pair, selection table migration, card component, journey definition, inference hints, and its own tests. Because Phases 1–3 generalized the engine, each mode is additive — no edits to the orchestrator loop.

**Phase 5 — Multi-modal + conversational inference polish.**
Leg-strip plan card, `multi_modal` journey, journey-type inference and revision-with-confirmation.

Each phase is independently shippable and leaves the app fully working.

---

## 8. Test strategy

Honor the `CLAUDE.md` disciplines explicitly:

- **Test-first for every fix.** Any bug found mid-refactor gets a failing test in the same commit as its fix, then passing (`pnpm format:check && pnpm lint && pnpm test && pnpm build`). No "deploy to see if it works."
- **ChatBox invariants — create it, then extend it.** `CLAUDE.md` mandates `apps/client/web/src/components/ChatBox/__tests__/ChatBox.invariants.test.tsx` before _any_ further ChatBox fix, but the file **does not exist yet** — Phase 0 must create it, encoding the invariants `CLAUDE.md` enumerates (tool-result cards persist after SSE end, no text-node duplication, empty-state render, stable virtualizer layout under append, QuickReplyChips only after the final assistant message). Every subsequent phase **extends that one file**, never a new ad-hoc test next to the component. New invariants to add on top: (a) `offer_tiles` cards persist after SSE end for every `OfferKind`; (b) the card registry renders a fallback, never throws, on an unknown kind; (c) virtualizer layout stays stable when `offer_tiles` of different kinds are appended; (d) QuickReplyChips still render only after the final assistant message.
- **Tracker migration tests.** v1→v3→v4 over real persisted `booking_state` fixtures; assert no in-flight trip loses selections. Exhaustive-switch tests over `SegmentKind`/`TrackerStatus` so a new mode fails to compile until every consumer handles it.
- **Production-asset build contract.** Any new runtime-loaded JSON (e.g. seed data for known rail operators or cruise ports) requires the post-`tsc` dist-content smoke test mandated by `CLAUDE.md` (the `bea33cc5` `destinations.json` lesson) — asserted after build, in CI, and inside `Dockerfile.server`.
- **Provider/KB tests.** `runSegmentSearch()` unit tests for each path: Redis hit, KB warm hit, cold web-search + write-back, quota-exhausted fallback to KB, stale-row re-verification. Web calls are mocked via the `ToolAdapters` seam so E2E stays deterministic (mirrors the existing `isMockMode()` pattern).
- **Verification subagent.** For the Phase 1 flow-engine swap (highest blast radius), a final review pass by a separate agent comparing pre/post behavior on a fixture corpus of transcripts.

---

## 9. Risks & tradeoffs

- **Phase 1 is the dangerous one.** Rewriting the tracker/routing under a live flow risks regressing the flight path. Mitigation: keep `flight_trip` behavior byte-for-byte identical, gate on the E2E suite + invariants spec + a migration parity test, ship it alone with no other change.
- **KB quality drift.** Web-sourced prices go stale and can be wrong. Mitigation: indicative-price labeling, `last_verified_at` staleness re-checks, confidence scoring + pruning, live verification of the specific selection before surfacing a booking URL, and provenance citations on every discovered offer.
- **Generic `Offer` vs. rich per-mode fields.** A flat `Offer` could lose mode-specific nuance. Mitigation: the typed `detail` bag + per-kind card component preserve richness at the presentation layer while the engine stays generic — the split is deliberate.
- **Web-search cost/latency on cold paths.** First niche lookup is slow. Mitigation: it happens once per region and warms the KB for everyone after; show `tool_progress` so the user sees work happening; cap cold-path fan-out.
- **Scope.** Five phases is a lot. Mitigation: Phases 0–2 deliver a cleaner codebase with zero new user features and are worth shipping on their own; new modes are then cheap.

---

## 10. Definition of done / anti-spaghetti guarantees

The refactor is successful only if **adding the next travel mode after this** (say, ferries) requires touching only additive files:

1. One `SegmentCapability` registration + one `JourneyType` (or slot) entry.
2. One tool-schema pair (`search_*`/`select_*`) in `tools/registry/`, auto-picked up by `toolRegistry.ts`.
3. One selection-table migration.
4. One `Offer` card component + one line in `offerCardRegistry`.
5. One `SegmentProvider` (`fromWeb` at minimum).

No edits to the orchestrator loop, `NodeRenderer`, `VirtualizedChat`, `selectSubAgent`, or the system-prompt builder. If a mode addition forces a change to any of those, the abstraction leaked and the design needs revisiting. The compiler enforces completeness: every `SegmentKind` added surfaces a type error at each exhaustive switch until handled, so nothing can be silently half-wired.
