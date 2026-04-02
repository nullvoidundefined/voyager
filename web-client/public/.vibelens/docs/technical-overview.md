<!-- vibelens format:1 -->

# Technical Overview

## System Architecture

Voyager follows a standard client-server architecture with a conversational AI agent at its core. The frontend is a Next.js 15 App Router application deployed to Vercel. The backend is an Express 5 API deployed to Railway via Docker. PostgreSQL on Neon provides persistence, and Redis on Railway provides caching for external API responses.

```
                    +-------------------+
                    |   Next.js 15      |
                    |   (Vercel)        |
                    |                   |
                    |  App Router       |
                    |  TanStack Query   |
                    |  AuthContext      |
                    |  ChatBox + SSE    |
                    +--------+----------+
                             |
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
                    |  Tool executor    |
                    +--+------+------+--+
                       |      |      |
            +----------+  +---+---+  +----------+
            |             |       |             |
      +-----v-----+ +----v----+ +v---------+ +-v--------+
      | PostgreSQL | | Redis   | | SerpApi  | | Google   |
      | (Neon)     | | (Rly)   | | Flights/ | | Places   |
      |            | | 1hr TTL | | Hotels   | | API      |
      +------------+ +---------+ +----------+ +----------+
```

## Backend Architecture

### Layered Structure

The server follows a strict layered architecture:

```
Routes  -->  Handlers  -->  Services  -->  Repositories  -->  Database
                               |
                            Tools  -->  External APIs
```

- **Routes** (`server/src/routes/`): Define Express routers, attach middleware like `requireAuth`. Files: `auth.ts`, `trips.ts`, `places.ts`, `userPreferences.ts`.
- **Handlers** (`server/src/handlers/`): Parse/validate requests, call services or repos, format responses. The `chat` handler (`handlers/chat/chat.ts`) is the most complex -- it loads trip context, sets up SSE, runs the agent loop, and persists messages.
- **Services** (`server/src/services/`): Business logic. `AgentOrchestrator.ts` is the core service -- a generic agentic loop class. `agent.service.ts` is a legacy wrapper. `serpapi.service.ts` wraps fetch calls to SerpApi. `cache.service.ts` wraps Redis get/set/del.
- **Repositories** (`server/src/repositories/`): Raw SQL queries via `pg`. No ORM. Files: `auth/auth.ts`, `trips/trips.ts`, `conversations/conversations.ts`, `tool-call-log/tool-call-log.ts`, `userPreferences/userPreferences.ts`.
- **Tools** (`server/src/tools/`): Each tool file exports a function that the executor dispatches to. `definitions.ts` exports the Anthropic tool schemas. `executor.ts` maps tool names to implementation functions.

### AgentOrchestrator

`server/src/services/AgentOrchestrator.ts` is the heart of the application. It is a class that accepts:

- `tools`: Anthropic tool definitions (JSON schemas)
- `systemPromptBuilder`: A function that builds the system prompt from context arguments
- `toolExecutor`: A function that executes a named tool with input
- `onToolExecuted`: Optional callback for logging/observability
- `maxIterations`: Safety limit (default 15)
- `model`: Claude model (default `claude-sonnet-4-20250514`)

The `run()` method implements the agentic loop:

```
while (true) {
    response = await claude.messages.create(messages, tools)
    if end_turn: return response text
    if tool_use: execute tools, append results, continue loop
    if over limit: return safety message
}
```

Progress events (`tool_start`, `tool_result`, `assistant`) are emitted via callback for real-time SSE streaming.

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

- Local lookup table with 24 major cities
- Returns IATA code, country, timezone, currency, best time to visit
- Returns error message for unknown cities

**update_trip** (dispatched in `server/src/tools/executor.ts`):

- Updates trip record in PostgreSQL with destination, dates, origin, budget
- Requires `ToolContext` (tripId + userId) for authorization

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

11 migrations in `server/migrations/` create:

| Table              | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `users`            | Email, password hash, first/last name                                   |
| `sessions`         | Session ID (SHA-256 hash), user_id, expires_at                          |
| `trips`            | Destination, origin, dates, budget, travelers, preferences, status      |
| `trip_flights`     | Selected flights for a trip (origin, destination, airline, price, etc.) |
| `trip_hotels`      | Selected hotels (name, city, star rating, prices, dates)                |
| `trip_experiences` | Selected experiences (name, category, rating, estimated cost)           |
| `conversations`    | One conversation per trip (1:1 relationship, UPSERT on trip_id)         |
| `messages`         | Conversation messages (role, content, tool_calls_json, token_count)     |
| `api_cache`        | Unused (caching moved to Redis)                                         |
| `tool_call_log`    | Observability: tool name, input/result JSON, latency, cache hit, error  |
| `user_preferences` | Dietary restrictions, travel intensity, social style per user           |

### System Prompt

`server/src/prompts/system-prompt.ts` builds a detailed system prompt that:

- Instructs Claude to search flights first (largest cost), then hotels, then experiences
- Requires `calculate_remaining_budget` after each booking category
- Requires `update_trip` as the first tool call when user provides destination/dates/budget
- Includes a topic guardrail (travel-only)
- Injects the current date to prevent past-date searches
- Appends `TripContext` with current trip details, selected bookings, and user preferences

## Frontend Architecture

### App Router Structure

```
web-client/src/app/
  layout.tsx              -- Root layout (Header, Footer, VibeLensBar, providers)
  page.tsx                -- Landing page (hero, demo, features, CTA)
  globals.scss            -- Global styles and CSS custom properties
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
  faq/page.tsx            -- FAQ page
```

### Key Components

**ChatBox** (`web-client/src/components/ChatBox/ChatBox.tsx`):
The main conversational interface. Handles:

- SSE stream reading from `POST /trips/:id/chat`
- Tool progress indicators (hourglass/checkmark per tool)
- Message rendering with inline widgets
- Trip details form detection and rendering
- Booking actions ("Book This Trip" / "Try Again")

**Widget Components** (`web-client/src/components/ChatBox/widgets/`):

- `FlightCard` -- Displays airline logo, route, departure time, price. Renders as a `<button>` with `aria-pressed`.
- `HotelCard` -- Displays hotel image, name, star rating, price per night, total. Includes static map preview.
- `ExperienceCard` -- Displays experience name, category, rating, estimated cost. Includes photo proxy.
- `SelectableCardGroup` -- Wraps card arrays with select/confirm flow. Horizontal scroll container.
- `QuickReplyChips` -- Parses assistant text for yes/no questions and renders clickable chip buttons.
- `InlineBudgetBar` -- Visual progress bar showing allocated vs. total budget with color-coded over-budget state.
- `ItineraryTimeline` -- Parses and renders day-by-day itinerary from assistant markdown.
- `TripDetailsForm` -- Detects numbered lists asking for trip details and renders an inline form (origin, dates, budget, travelers).

**BookingConfirmation** (`web-client/src/components/BookingConfirmation/BookingConfirmation.tsx`):
Modal overlay with three stages: review (cost breakdown + confirm/cancel), booking (spinner animation), confirmed (checkmark animation). Auto-advances between stages.

### State Management

- **TanStack Query** handles all server state. Query keys: `["auth", "me"]`, `["trips"]`, `["trips", id]`, `["messages", tripId]`, `["preferences"]`.
- **AuthContext** (`web-client/src/context/AuthContext.tsx`): Wraps the app. Uses TanStack Query internally for `/auth/me`. Provides `user`, `isLoading`, `login`, `signup`, `logout`.
- **QueryProvider** (`web-client/src/providers/QueryProvider.tsx`): Configures TanStack QueryClient.
- Component-local state for: chat input, streaming text, tool progress, selected cards, booking confirmation stage.

### API Client

`web-client/src/lib/api.ts` exports `get`, `post`, `put`, `del` functions that:

- Prepend `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001`)
- Include `credentials: "include"` for session cookies
- Include `X-Requested-With: XMLHttpRequest` for CSRF
- Throw `ApiError` with status code and error message on non-2xx responses

The chat endpoint is called directly with `fetch` (not via the API client) because it requires SSE stream reading.

### Styling

- SCSS Modules for component-scoped styles
- CSS custom properties defined in `globals.scss`
- No Tailwind, no CSS-in-JS
- Each component has a co-located `.module.scss` file

## Testing Strategy

### Unit Tests (Vitest)

- Every handler, repository, tool, middleware, and service has co-located `*.test.ts` files
- Tools mock `serpapi.service.ts` and `cache.service.ts` with `vi.mock()`
- `AgentOrchestrator.test.ts` tests the full agentic loop with mock Claude responses
- Test utilities in `server/src/utils/tests/`: `mockResult.ts`, `mockLogger.ts`, `responseHelpers.ts`, `uuids.ts`

### Integration Tests

- `server/src/__integration__/auth.integration.test.ts` -- tests auth flow against real Express routes
- `server/src/__integration__/cors.integration.test.ts` -- tests CORS headers
- Require a real PostgreSQL database via `DATABASE_URL`

### E2E Tests (Playwright)

- `e2e/` directory at project root
- Configuration in `playwright.config.ts`

### Smoke Tests

- `scripts/smoke-test.sh` verifies health endpoints and service startup

## Security

- Helmet.js for security headers
- CORS with explicit origin allowlist (no wildcard)
- CSRF protection via `X-Requested-With` header requirement
- Rate limiting on all routes (general) and auth routes (stricter)
- Session tokens stored as SHA-256 hashes (database leak does not expose sessions)
- Request body size limited to 10KB
- Request timeout of 30 seconds
- Password hashing with bcrypt (12 rounds)
- `httpOnly` + `secure` + `sameSite` cookie flags
