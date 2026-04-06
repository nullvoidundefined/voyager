<!-- vibelens format:1 -->

# Technical Overview

## System Architecture

Voyager follows a standard client-server architecture with a conversational AI agent at its core. The frontend is a Next.js 15 App Router application deployed to Vercel. The backend is an Express 5 API deployed to Railway via Docker. PostgreSQL on Neon provides persistence, and Redis on Railway provides caching for external API responses. A `packages/shared-types` workspace package publishes the `ChatNode` discriminated union and supporting interfaces, which are imported by both the server and the frontend. A Vercel rewrite rule proxies `/api/*` requests to the Railway backend, making API calls same-origin from the browser's perspective (solving Safari ITP cookie issues).

```
                    +-------------------+
                    |   Next.js 15      |
                    |   (Vercel)        |
                    |                   |
                    |  App Router       |
                    |  TanStack Query   |
                    |  TanStack Virtual |
                    |  AuthContext      |
                    |  useSSEChat hook  |
                    |  NodeRenderer     |
                    +--------+----------+
                             |
                    Vercel rewrites: /api/* -> Railway
                    HTTPS (credentials: include)
                    X-Requested-With: XMLHttpRequest
                             |
                    +--------v----------+
                    |   Express 5 API   |
                    |   (Railway)       |
                    |                   |
                    |  Auth middleware   |
                    |  Chat handler     |
                    |  AgentOrchestrator|
                    |  Booking State    |
                    |  Category Prompts |
                    |  Node Builder     |
                    |  Enrichment Svc   |
                    +--+------+------+--+
                       |      |      |
            +----------+  +---+---+  +----------+
            |             |       |             |
      +-----v-----+ +----v----+ +v---------+ +-v--------+
      | PostgreSQL | | Redis   | | SerpApi  | | Google   |
      | (Neon)     | | (Rly)   | | Flights/ | | Places   |
      |            | | 1hr TTL | | Hotels/  | | API      |
      +------------+ +---------+ | Cars     | +----------+
                                 +----------+
                                       |
                               +-------v-------+
                               | State Dept    |
                               | FCDO          |
                               | Open-Meteo    |
                               | Visa Matrix   |
                               +---------------+
```

## Monorepo Packages

```
/
  packages/
    shared-types/       -- ChatNode union, Flight, Hotel, CarRental, Experience, SSEEvent
  server/               -- Express 5 API
  web-client/           -- Next.js 15 frontend
```

`packages/shared-types` is a TypeScript-only package (`@voyager/shared-types`) imported by both `server/` and `web-client/`. It is the single source of truth for the typed chat protocol. Changes to `ChatNode` are immediately reflected in both packages, and TypeScript enforces that every node type has a corresponding component in the frontend's `NodeRenderer`.

## Backend Architecture

### Layered Structure

The server follows a strict layered architecture:

```
Routes  -->  Handlers  -->  Services  -->  Repositories  -->  Database
                               |
                  Node Builder + Enrichment
                               |
                            Tools  -->  External APIs
```

- **Routes** (`server/src/routes/`): Define Express routers, attach middleware like `requireAuth`. Files: `auth.ts`, `trips.ts`, `places.ts`, `userPreferences.ts`.
- **Handlers** (`server/src/handlers/`): Parse/validate requests, call services or repos, format responses. The `chat` handler (`handlers/chat/chat.ts`) is the most complex -- it loads trip context (including booking state), computes `FlowPosition`, selects the appropriate per-category prompt, sets up SSE, runs the agent loop, advances the booking state machine, appends enrichment nodes, and persists messages.
- **Services** (`server/src/services/`): Business logic. `AgentOrchestrator.ts` is the core service. `node-builder.ts` maps tool results to ChatNodes. `enrichment.ts` orchestrates auto-enrichment. `serpapi.service.ts` wraps fetch calls to SerpApi. `cache.service.ts` wraps Redis get/set/del.
- **Repositories** (`server/src/repositories/`): Raw SQL queries via `pg`. No ORM. Files: `auth/auth.ts`, `trips/trips.ts`, `conversations/conversations.ts`, `tool-call-log/tool-call-log.ts`, `userPreferences/userPreferences.ts`.
- **Tools** (`server/src/tools/`): Each tool file exports a function that the executor dispatches to. `definitions.ts` exports the Anthropic tool schemas for all 12 tools. `executor.ts` maps tool names to implementation functions.
- **Prompts** (`server/src/prompts/`): `booking-steps.ts` defines the state machine types and transitions. `category-prompts.ts` provides per-category, per-status prompt text. `system-prompt.ts` builds the consolidated system prompt.
- **Data** (`server/src/data/`): `cities.ts` is the consolidated city database with 197 cities.

### AgentOrchestrator

`server/src/services/AgentOrchestrator.ts` is the heart of the application. It is a class that accepts:

- `tools`: Anthropic tool definitions (JSON schemas for 12 tools)
- `systemPromptBuilder`: A function that builds the system prompt from context arguments
- `toolExecutor`: A function that executes a named tool with input
- `onToolExecuted`: Optional callback for logging/observability
- `maxIterations`: Safety limit (default 15)
- `model`: Claude model (default `claude-sonnet-4-20250514`)

The `run()` method implements the agentic loop with token streaming via `messages.stream()`:

```
while (true) {
    response = await claude.messages.stream(messages, tools)
    if end_turn: return response text
    if tool_use: execute tools, append results, continue loop
    if over limit: return safety message
}
```

Progress events (`tool_start`, `tool_result`, `assistant`) are emitted via callback for real-time SSE streaming.

### Per-Category State Machine

`server/src/prompts/booking-steps.ts` is the second most important file after the orchestrator. It defines:

**BookingState** -- a versioned JSONB object stored on the `trips` table:

```typescript
interface BookingState {
  version: number;
  flights: CategoryState; // { status: CategoryStatus, meta?: ... }
  hotels: CategoryState;
  car_rental: CategoryState;
  experiences: CategoryState;
}
```

**CategoryStatus** -- the lifecycle of each booking category: `idle` -> `asking` -> `presented` -> `done` | `skipped`

**FlowPosition** -- a discriminated union computed by `getFlowPosition()`:

- `{ phase: 'COLLECT_DETAILS' }` -- trip is missing required fields (budget, dates, origin)
- `{ phase: 'CATEGORY', category: CategoryName, status: CategoryStatus }` -- working on a specific category
- `{ phase: 'CONFIRM' }` -- all categories done/skipped, ready for checkout
- `{ phase: 'COMPLETE' }` -- trip is booked

**State transitions** -- `advanceBookingState()` advances the current category:

- `idle` -> `asking` (always on first turn)
- `asking` -> `presented` (when the search tool for that category was called)
- `presented` -> `done` (when a selection exists in the trip record)
- Any status -> `skipped` (when `format_response.skip_category` is true)

**Category order**: flights, hotels, car_rental, experiences. Flights auto-skip when `transport_mode` is `"driving"`.

### Per-Category Prompts

`server/src/prompts/category-prompts.ts` replaces the monolithic system prompt with focused, step-specific prompts:

- **flights.idle**: "Ask the user: will you be flying or driving?"
- **flights.asking**: "Ask what time of day they prefer, then search flights."
- **flights.presented**: "The user is browsing flight options. Do NOT re-describe the results."
- **hotels.idle/asking**: "Do you need a hotel?"
- **car_rental.idle/asking**: "Will you need a rental car?"
- **experiences.idle/asking**: "Suggest relevant experience categories, then search."
- All `.presented` prompts: "Wait for selection. When the user selects, call select\_[category]."

Shared rules enforce: 1-2 sentences max, no bullet points for questions, never describe search results in text, always call `format_response` last, max 15 tool calls.

User preferences are injected per-category: accommodation preference for hotels, activities/dining for experiences, travel party for all categories.

### Tool Implementations

**search_flights** (`server/src/tools/flights.tool.ts`):

- Calls SerpApi `google_flights` engine with IATA codes, dates, passengers
- Normalizes `SerpApiFlight` responses into `FlightResult` objects
- Filters by `max_price`, sorts by price, returns top 5
- Caches results in Redis for 1 hour

**search_hotels** (`server/src/tools/hotels.tool.ts`):

- Calls SerpApi `google_hotels` engine with city name, dates, guests
- Normalizes `SerpApiHotel` responses into `HotelResult` objects
- Filters by star rating and max price per night
- Caches results in Redis for 1 hour

**search_car_rentals** (`server/src/tools/car-rentals.tool.ts`):

- Calls SerpApi `google_car_rental` engine with pickup location, dates, optional car type
- Normalizes `SerpApiCarResult` responses into `CarRentalResult` objects (provider, car name, type, price per day, total, features)
- Returns top 5 results; caches in Redis for 1 hour

**search_experiences** (`server/src/tools/experiences.tool.ts`):

- Calls Google Places Text Search API with location + category keywords
- Uses field mask for efficient responses: id, displayName, address, rating, priceLevel, photos, location
- Maps `priceLevel` enums to estimated USD costs ($0-$150 range)
- Caches results in Redis for 1 hour

**calculate_remaining_budget** (`server/src/tools/budget.tool.ts`):

- Pure computation -- no external API calls
- Calculates total spent, remaining, percentage breakdowns by category
- Returns `over_budget` flag and warning message when applicable

**get_destination_info** (`server/src/tools/destination.tool.ts`):

- Delegates to `lookupCity()` in the consolidated city database (197 cities)
- Returns IATA code, country, timezone, currency, best time to visit
- Returns error message for unknown cities

**update_trip** (dispatched in `server/src/tools/executor.ts`):

- Updates trip record in PostgreSQL with destination, dates, origin, budget, transport_mode
- Requires `ToolContext` (tripId + userId) for authorization

**select_flight / select_hotel / select_car_rental / select_experience** (dispatched in `executor.ts`):

- Persist user selections to dedicated tables (`trip_flights`, `trip_hotels`, `trip_car_rentals`, `trip_experiences`)
- Require `ToolContext` for authorization
- Called by the agent when the user confirms a selection from the tile cards

**format_response** (handled in chat handler):

- Required as the agent's final tool call every turn
- Accepts `text` (markdown), `citations`, `quick_replies`, optional `advisory` escalation, and `skip_category` flag
- All agent text output goes through this tool -- Claude does not produce free-form text outside it
- The `skip_category` field triggers the booking state machine to skip the current category

### Node Builder Layer

`server/src/services/node-builder.ts` maps raw tool results to `ChatNode` objects:

| Tool result                  | ChatNode produced  |
| ---------------------------- | ------------------ |
| `search_flights`             | `flight_tiles`     |
| `search_hotels`              | `hotel_tiles`      |
| `search_car_rentals`         | `car_rental_tiles` |
| `search_experiences`         | `experience_tiles` |
| `calculate_remaining_budget` | `budget_bar`       |
| Other tools                  | `null` (no node)   |

The node builder also normalizes raw API response shapes into the clean `Flight`, `Hotel`, `CarRental`, and `Experience` interfaces from `shared-types`, assigning UUIDs in the process.

### Auto-Enrichment Service

`server/src/services/enrichment.ts` is called by the chat handler after a destination is resolved. It returns a `ChatNode[]` that is appended to the message stream automatically, without any agent tool calls:

| Source                               | Output                                            |
| ------------------------------------ | ------------------------------------------------- |
| US State Dept advisory API           | `advisory` node (severity: info/warning/critical) |
| UK FCDO advisory API                 | `advisory` node                                   |
| Open-Meteo forecast API              | `weather_forecast` node (7-day)                   |
| Visa matrix (static lookup)          | `advisory` node with visa requirements            |
| Driving requirements (static lookup) | `advisory` node with traffic side, license info   |

The service uses `Promise.allSettled` for the async sources, so a failure from any single source does not block the others. Coordinates for cities are sourced from the consolidated city database; destinations not in the database silently skip enrichment.

### Typed Chat Protocol

`packages/shared-types/src/nodes.ts` defines the `ChatNode` discriminated union with 12 variants:

| Type               | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `text`             | Markdown content with optional citations array                              |
| `flight_tiles`     | Flight search results, selectable                                           |
| `hotel_tiles`      | Hotel search results, selectable                                            |
| `car_rental_tiles` | Car rental search results, selectable                                       |
| `experience_tiles` | Experience/activity search results, selectable                              |
| `travel_plan_form` | Structured form for collecting trip details                                 |
| `itinerary`        | Day-by-day plan (array of `DayPlan`)                                        |
| `advisory`         | Travel advisory, visa info, driving rules (severity: info/warning/critical) |
| `weather_forecast` | 7-day weather outlook (array of `WeatherDay`)                               |
| `budget_bar`       | Budget allocation tracker (allocated, total, currency)                      |
| `quick_replies`    | Suggested next action buttons                                               |
| `tool_progress`    | Tool execution status indicator (running/done)                              |

The `ChatNodeOfType<T>` helper type extracts a specific variant for narrowly-typed component props.

### SSE Protocol

The chat endpoint emits these typed SSE event shapes (defined in `SSEEvent` in shared-types):

| Event type      | Payload                          | Purpose                          |
| --------------- | -------------------------------- | -------------------------------- |
| `node`          | `{ node: ChatNode }`             | A complete node ready to display |
| `text_delta`    | `{ content: string }`            | Streaming text fragment          |
| `tool_progress` | `{ tool_id, tool_name, status }` | Tool execution start/completion  |
| `done`          | `{}`                             | Stream complete                  |
| `error`         | `{ error: string }`              | Error condition                  |

### Middleware Stack

Applied in this order in `server/src/app.ts`:

1. `helmet()` -- security headers
2. `corsConfig` -- CORS with explicit origin allowlist from `CORS_ORIGIN` env var
3. `requestLogger` -- Pino structured logging with request IDs
4. `rateLimiter` -- general rate limiting
5. `express.json({ limit: "10kb" })` -- body parsing with size cap
6. `express.urlencoded({ extended: true, limit: "10kb" })` -- form parsing
7. `cookieParser()` -- parse session cookies
8. `csrfGuard` -- reject state-changing requests without `X-Requested-With`
9. `loadSession` -- read session cookie, attach `req.user` if valid
10. Request timeout (30 seconds)

### Authentication Flow

Custom session-based auth (not Supabase):

- Passwords hashed with bcrypt (12 salt rounds)
- Sessions are random 32-byte tokens; the SHA-256 hash is stored in the `sessions` table
- Registration and login use database transactions (`withTransaction`) to prevent orphan rows
- Login deletes all existing sessions for the user before creating a new one
- Cookie options: `httpOnly`, `sameSite: "none"` in production, `secure` in production
- Session lookup joins `sessions` and `users` tables in one query

### Database Schema

13 migrations in `server/migrations/` create:

| Table              | Purpose                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `users`            | Email, password hash, first/last name                                                                         |
| `sessions`         | Session ID (SHA-256 hash), user_id, expires_at                                                                |
| `trips`            | Destination, origin, dates, budget, travelers, preferences, status, `booking_state` (JSONB), `transport_mode` |
| `trip_flights`     | Selected flights for a trip (origin, destination, airline, price, etc.)                                       |
| `trip_hotels`      | Selected hotels (name, city, star rating, prices, dates)                                                      |
| `trip_experiences` | Selected experiences (name, category, rating, estimated cost)                                                 |
| `trip_car_rentals` | Selected car rentals (provider, car name, type, price, dates)                                                 |
| `conversations`    | One conversation per trip (1:1 relationship, UPSERT on trip_id)                                               |
| `messages`         | Dual-column: `nodes` JSONB for UI + `content`/`tool_calls_json` for agent                                     |
| `api_cache`        | Unused (caching moved to Redis)                                                                               |
| `tool_call_log`    | Observability: tool name, input/result JSON, latency, cache hit, error                                        |
| `user_preferences` | 7-category preferences as versioned JSONB per user                                                            |

The `messages` table uses a **dual-column pattern**: `nodes` (JSONB `ChatNode[]`) is the display representation; `content` + `tool_calls_json` are the API conversation representation. These evolve independently. Two columns support the typed protocol: `schema_version` (INTEGER) for forward-compatible rendering, and `sequence` (INTEGER, unique per conversation) for strict ordering.

The `trips` table stores `booking_state` as a JSONB column with a `version` field. The `normalizeBookingState()` function handles missing fields and version migration.

### User Preferences Schema

`server/src/schemas/userPreferences.ts` defines the 7-category preference model with versioned JSONB:

- **Version 1 (current)**: accommodation, travel_pace, dietary, dining_style, activities, travel_party, budget_comfort, completed_steps
- **Version 0 (legacy)**: intensity, social, dietary -- `normalizePreferences()` migrates these to v1 field names
- The `completed_steps` array tracks which of the 6 wizard steps have been finished
- Activities is multi-select (up to 10 options); dietary is multi-select (8 options); all others are single-select

### System Prompt Architecture

The system prompt is now built dynamically based on the `FlowPosition`:

- **COLLECT_DETAILS phase**: Minimal prompt acknowledging the destination
- **CATEGORY phase**: Per-category, per-status prompt from `category-prompts.ts` with user preferences injected
- **CONFIRM phase**: Summarize trip and ask for booking confirmation
- **COMPLETE phase**: Answer follow-up questions about the booked trip

All prompts share common rules: 1-2 sentences max, no bullet points for questions, never describe search results in text, always call `format_response` last, max 15 tool calls, call `update_trip` when user provides trip details, set `skip_category` when user declines a category.

## Frontend Architecture

### App Router Structure

```
web-client/src/app/
  layout.tsx              -- Root layout (Header, Footer, VibeLensBar, providers)
  page.tsx                -- Landing page (hero, demo, features, CTA)
  globals.scss            -- Global styles, Mediterranean Warmth CSS custom properties
  (auth)/
    login/page.tsx        -- Login form
    register/page.tsx     -- Registration form
  (protected)/
    layout.tsx            -- Auth guard wrapper
    trips/
      page.tsx            -- Trip list with delete (optimistic updates)
      new/page.tsx        -- Auto-creates trip and redirects to detail
      [id]/page.tsx       -- Trip detail: cost breakdown, itinerary, ChatBox
    account/page.tsx      -- Profile, preferences, usage stats
  explore/
    page.tsx              -- 30-destination grid with category filtering and search
    [slug]/page.tsx       -- Destination detail page with guide content
  faq/page.tsx            -- FAQ page
```

### Key Components

**ChatBox** (`web-client/src/components/ChatBox/ChatBox.tsx`):
The main conversational interface. Coordinates the `useSSEChat` hook, `VirtualizedChat`, and booking action buttons. Handles the `TripDetailsForm` detection and confirmation flow.

**useSSEChat** (`web-client/src/components/ChatBox/useSSEChat.ts`):
Custom hook that manages the SSE stream lifecycle. Reads typed `SSEEvent` objects from the stream and accumulates `streamingNodes` (complete ChatNodes ready to render), `toolProgress` (running/done tool indicators), and `streamingText` (partial text delta from token streaming). On stream completion, invalidates TanStack Query caches for messages and the trip.

**VirtualizedChat** (`web-client/src/components/ChatBox/VirtualizedChat.tsx`):
Renders the message list using `@tanstack/react-virtual`. Each `ChatMessage` contains a `nodes: ChatNode[]` array. The virtualizer estimates row heights by node type (e.g., `flight_tiles` = 240px, `budget_bar` = 48px) and measures actual heights after render. Streaming messages are composed into a synthetic `__streaming__` message appended to the list during active turns.

**NodeRenderer** (`web-client/src/components/ChatBox/NodeRenderer.tsx`):
Component registry -- a switch statement over `ChatNode['type']` that renders the appropriate component. TypeScript's exhaustiveness check ensures every node type in the discriminated union has a registered component. Accepts a `NodeRendererCallbacks` interface for selection/confirmation handlers.

**Node Components** (`web-client/src/components/ChatBox/nodes/`):

- `FlightTiles` -- Renders airline, route, departure time, price. Selectable.
- `HotelTiles` -- Renders hotel image, name, star rating, price per night, total. Selectable.
- `CarRentalTiles` -- Renders provider logo, car name, type, price per day, features. Selectable.
- `ExperienceTiles` -- Renders name, category, rating, estimated cost. Selectable.
- `AdvisoryCard` -- Renders travel advisories with severity styling (info/warning/critical).
- `WeatherForecast` -- Renders 7-day forecast with high/low temperatures and condition icons.
- `BudgetBar` -- Visual progress bar showing allocated vs. total budget with over-budget state.
- `MarkdownText` -- Renders agent text with `react-markdown` and inline citations.
- `ToolProgressIndicator` -- Hourglass/checkmark per tool call.

**Widget Components** (`web-client/src/components/ChatBox/widgets/`):

- `QuickReplyChips` -- Renders clickable chip buttons for suggested next actions.
- `ItineraryTimeline` -- Renders day-by-day itinerary.
- `TripDetailsForm` -- Inline form for collecting origin, dates, budget, travelers.

**PreferencesWizard** (`web-client/src/components/PreferencesWizard/PreferencesWizard.tsx`):
6-step modal wizard for collecting travel preferences. Steps: Accommodation, Travel Pace, Dining (dietary + dining style), Activities, Travel Party, Budget. Each step saves immediately via `PUT /user-preferences`. Progress bar with clickable completed-step circles. Opens automatically after registration and from the account page. Supports Back, Skip, and Next navigation.

**BookingConfirmation** (`web-client/src/components/BookingConfirmation/BookingConfirmation.tsx`):
Modal overlay with three stages: review (cost breakdown + confirm/cancel), booking (spinner animation), confirmed (checkmark animation). Auto-advances between stages.

### Explore Mode Components

**ExplorePage** (`web-client/src/app/explore/page.tsx`):
Public page with a hero carousel (5 rotating Unsplash images), category filter pills (9 categories), text search input, and a responsive grid of 30 destination cards. Each card shows: Unsplash photo, city name, country, price level indicator, best season, and up to 2 category tags.

**Destination Detail** (`web-client/src/app/explore/[slug]/page.tsx`):
Static destination guide pages with hero image, quick stats bar, description, top 10 experiences, dining highlights, neighborhoods, 12-month weather data, visa summary, and "Plan a trip to [city]" CTA.

### Destination Imagery

`web-client/src/lib/destinationImage.ts` maintains a static map of 30 city names to Unsplash photo IDs. The `getDestinationImage()` function returns an Unsplash CDN URL at `600x300` for cards. `getDestinationImageUrl()` accepts custom dimensions for hero images. A `HERO_IMAGES` array of 5 destinations (Santorini, Tokyo, Paris, Bali, New York) powers the Explore page hero carousel. Unknown cities get a gradient fallback instead of a photo.

### State Management

- **TanStack Query** handles all server state. Query keys: `["auth", "me"]`, `["trips"]`, `["trips", id]`, `["messages", tripId]`, `["preferences"]`, `["user-preferences"]`.
- **`useSSEChat`** manages streaming state (nodes, tool progress, streaming text) as component-local state.
- **`VirtualizedChat`** receives all rendering inputs as props from the ChatBox parent.
- **AuthContext** (`web-client/src/context/AuthContext.tsx`): Wraps the app. Uses TanStack Query internally for `/auth/me`. Provides `user`, `isLoading`, `login`, `signup`, `logout`.
- No client-side store (no Redux, no Zustand) -- all state is server-derived or component-local.

### API Client

`web-client/src/lib/api.ts` exports `get`, `post`, `put`, `del` functions that:

- Prepend `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001`)
- Include `credentials: "include"` for session cookies
- Include `X-Requested-With: XMLHttpRequest` for CSRF
- Throw `ApiError` with status code and error message on non-2xx responses

The chat endpoint is called directly via `fetch` (inside `useSSEChat`, not the API client) because it requires SSE stream reading.

### Styling

- **Mediterranean Warmth** light-only theme: warm coral, terracotta, cream, and teal tones
- CSS custom properties defined in `globals.scss` -- no hardcoded colors in component styles
- SCSS Modules for component-scoped styles
- No Tailwind, no CSS-in-JS
- Each component has a co-located `.module.scss` file
- No dark mode -- light theme only

## Testing Strategy

### Unit Tests (Vitest)

- 330 tests across 37 test files
- Every handler, repository, tool, middleware, service, prompt, and schema has co-located `*.test.ts` files
- Tools mock `serpapi.service.ts` and `cache.service.ts` with `vi.mock()`
- `AgentOrchestrator.test.ts` tests the full agentic loop with mock Claude responses
- `booking-steps.test.ts` has 28 tests covering state transitions, flow position computation, and normalization
- `category-prompts.test.ts` has 21 tests covering prompt generation for all category/status combinations
- `userPreferences.test.ts` has 9 tests covering normalization and legacy migration
- Test utilities in `server/src/utils/tests/`: `mockResult.ts`, `mockLogger.ts`, `responseHelpers.ts`, `uuids.ts`

### Integration Tests

- `server/src/__integration__/auth.integration.test.ts` -- tests auth flow against real Express routes
- `server/src/__integration__/cors.integration.test.ts` -- tests CORS headers
- Require a real PostgreSQL database via `DATABASE_URL`

### E2E Tests (Playwright)

- `e2e/` directory at project root with 8 test files covering all 35 user stories
- Test files: `public.spec.ts`, `explore.spec.ts`, `auth.spec.ts`, `trips.spec.ts`, `chat.spec.ts`, `checkout.spec.ts`, `preferences.spec.ts`, `account.spec.ts`
- Configuration in `playwright.config.ts`

### Smoke Tests

- `scripts/smoke-test.sh` verifies health endpoints and service startup

### Pre-Commit/Pre-Push Hooks

- **Lefthook** manages git hooks via `lefthook.yml`
- **Pre-commit** (parallel): `pnpm format:check` + `pnpm lint`
- **Pre-push**: `pnpm format:check` + `pnpm lint` + `pnpm --filter voyager-server build`

## Security

- Helmet.js for security headers
- CORS with explicit origin allowlist (no wildcard)
- CSRF protection via `X-Requested-With` header requirement
- Same-origin API proxy via Vercel rewrites (avoids Safari ITP cookie blocking)
- Rate limiting on all routes (general) and auth routes (stricter)
- Session tokens stored as SHA-256 hashes (database leak does not expose sessions)
- Request body size limited to 10KB
- Request timeout of 30 seconds
- Password hashing with bcrypt (12 rounds)
- `httpOnly` + `secure` + `sameSite` cookie flags
