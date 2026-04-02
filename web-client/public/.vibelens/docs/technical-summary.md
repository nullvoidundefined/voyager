<!-- vibelens format:1 -->

# Technical Summary

## Architecture at a Glance

Voyager is a fullstack monorepo with a Next.js 15 frontend and an Express 5 + TypeScript API. The core feature is an **agentic tool-use loop** where Claude calls external travel APIs iteratively, reasoning between calls to build budget-aware itineraries.

```
Browser (Next.js)  -->  Express API  -->  Anthropic Claude
                            |                    |
                            |              Tool calls (3-8 per turn)
                            |                    |
                        PostgreSQL         SerpApi / Google Places
                            |
                          Redis (cache)
```

## Core Concepts

### The Agent Loop

The `AgentOrchestrator` class (`server/src/services/AgentOrchestrator.ts`) implements a while-loop that:

1. Sends conversation messages + tool definitions to Claude
2. If Claude returns `stop_reason: "end_turn"` -- return the text response
3. If Claude returns `stop_reason: "tool_use"` -- execute each tool, append results as `tool_result` messages, and loop back to step 1
4. Safety limit: 15 tool calls per turn maximum

The orchestrator emits `ProgressEvent`s (`tool_start`, `tool_result`, `assistant`) that the chat handler streams to the frontend via SSE.

### Tools

Six tools are registered with Claude via `TOOL_DEFINITIONS` in `server/src/tools/definitions.ts`:

| Tool | Implementation | External API |
|---|---|---|
| `search_flights` | `flights.tool.ts` | SerpApi `google_flights` engine |
| `search_hotels` | `hotels.tool.ts` | SerpApi `google_hotels` engine |
| `search_experiences` | `experiences.tool.ts` | Google Places Text Search |
| `calculate_remaining_budget` | `budget.tool.ts` | Local computation (no API) |
| `get_destination_info` | `destination.tool.ts` | Local lookup table (24 cities) |
| `update_trip` | `executor.ts` -> `trips.ts` repo | PostgreSQL update |

### Data Flow for a Chat Turn

1. Frontend sends `POST /trips/:id/chat` with `{ message }` and `X-Requested-With` header
2. Chat handler loads trip, user preferences, and conversation history from PostgreSQL
3. Builds `TripContext` with selected flights/hotels/experiences and budget state
4. Calls `runAgentLoop()` which delegates to `AgentOrchestrator.run()`
5. Tool results are streamed back via SSE events
6. User and assistant messages are persisted to `messages` table
7. Frontend parses SSE stream, renders tool progress indicators, result cards, and final text

### Authentication

Custom session-based auth (no Supabase for this app):

- `POST /auth/register` -- bcrypt hash (12 rounds), create user + session in a transaction
- `POST /auth/login` -- verify password, delete old sessions, create new session in a transaction
- Sessions stored as SHA-256 hashes in `sessions` table; raw token in httpOnly cookie
- `loadSession` middleware reads cookie on every request; `requireAuth` blocks unauthenticated access

### Caching Strategy

Redis caches SerpApi and Google Places responses with a 1-hour TTL:

- Cache keys are deterministic: `api_cache:{provider}:{endpoint}:{sorted_params_json}`
- `normalizeCacheKey()` lowercases and sorts params for consistent cache hits
- Critical for staying within SerpApi's 250 searches/month free tier

### Database Schema

11 migration files create these tables: `users`, `sessions`, `trips`, `trip_flights`, `trip_hotels`, `trip_experiences`, `conversations`, `messages`, `api_cache`, `tool_call_log`, `user_preferences`

### Frontend State Management

- **TanStack Query** for all server state (trips, messages, user preferences, auth)
- `AuthContext` wraps the app with `useQuery` for `/auth/me` and provides `login`, `signup`, `logout`
- No client-side store (no Redux, no Zustand) -- all state is server-derived or component-local

### CSRF Protection

Header-only CSRF: all mutating requests must include `X-Requested-With: XMLHttpRequest`. The `csrfGuard` middleware rejects state-changing requests without this header.

## Deployment

- **Frontend**: `cd web-client && npx vercel --prod` -- deploys to Vercel
- **Backend**: `railway up --detach` from monorepo root -- builds `Dockerfile.server`, runs `node server/dist/index.js`
- Multi-stage Docker build: Node 22-slim base, pnpm workspace install, TypeScript compile, production-only deps in final image
