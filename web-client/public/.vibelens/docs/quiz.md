<!-- vibelens format:1 -->

# Technical Quiz -- Voyager AI Travel Concierge

---

**Q1. What is the name of the AI model used by the AgentOrchestrator?**
? This is defined as a constant in AgentOrchestrator.ts.
- A) gpt-4-turbo
- B) claude-sonnet-4-20250514
- C) claude-3-opus
- D) claude-3-haiku
> **B)** The `DEFAULT_MODEL` constant in `server/src/services/AgentOrchestrator.ts` is set to `"claude-sonnet-4-20250514"`. This is the Claude model used for all agentic tool-use interactions.
[difficulty:easy]

---

**Q2. How many tools are registered with Claude for the agent loop?**
? Check the TOOL_DEFINITIONS array in server/src/tools/definitions.ts.
- A) 4
- B) 5
- C) 6
- D) 8
> **C)** Six tools are defined: `search_flights`, `search_hotels`, `search_experiences`, `calculate_remaining_budget`, `update_trip`, and `get_destination_info`.
[difficulty:easy]

---

**Q3. What package manager does this monorepo use?**
? Look at the packageManager field in the root package.json.
- A) npm
- B) yarn
- C) pnpm
- D) bun
> **C)** The root `package.json` specifies `"packageManager": "pnpm@9.15.9"` and uses `pnpm-workspace.yaml` for workspace configuration.
[difficulty:easy]

---

**Q4. What is the maximum number of tool calls allowed per agent turn?**
? This is a safety limit defined in the AgentOrchestrator.
- A) 5
- B) 8
- C) 10
- D) 15
> **D)** `DEFAULT_MAX_ITERATIONS` in `AgentOrchestrator.ts` is set to 15. The system prompt also mentions this limit: "You may call up to 15 tools per turn."
[difficulty:easy]

---

**Q5. What external service provides flight search data?**
? The flights tool calls an external search API.
- A) Amadeus API
- B) Skyscanner API
- C) SerpApi (Google Flights engine)
- D) Kayak API
> **C)** `searchFlights()` in `flights.tool.ts` calls `serpApiGet("google_flights", params)`, which queries SerpApi's Google Flights engine.
[difficulty:easy]

---

**Q6. How does Voyager protect against CSRF attacks?**
? Look at the csrfGuard middleware and the frontend API client headers.
- A) CSRF tokens generated per session
- B) Double-submit cookie pattern
- C) X-Requested-With header requirement on state-changing requests
- D) Origin header validation only
> **C)** The `csrfGuard` middleware in `server/src/middleware/csrfGuard/csrfGuard.ts` rejects state-changing requests (POST, PUT, PATCH, DELETE) that do not include the `X-Requested-With: XMLHttpRequest` header. The frontend API client adds this header to every request.
[difficulty:easy]

---

**Q7. What hashing algorithm is used to store session tokens in the database?**
? The auth repository hashes tokens before storing them.
- A) MD5
- B) SHA-1
- C) SHA-256
- D) bcrypt
> **C)** The `hashSessionToken()` function in `server/src/repositories/auth/auth.ts` uses `crypto.createHash("sha256")` to hash session tokens. The raw token goes in the cookie; the hash goes in the `sessions` table. This means a database leak does not directly expose active sessions.
[difficulty:medium]

---

**Q8. What is the cache TTL for SerpApi responses in Redis?**
? Look at the CACHE_TTL constant in the tool files.
- A) 5 minutes
- B) 15 minutes
- C) 1 hour
- D) 24 hours
> **C)** All three API tool files (`flights.tool.ts`, `hotels.tool.ts`, `experiences.tool.ts`) define `const CACHE_TTL = 3600` (3600 seconds = 1 hour).
[difficulty:easy]

---

**Q9. How does the frontend receive real-time updates during an agent turn?**
? The chat handler sets specific response headers.
- A) WebSocket connection
- B) Server-Sent Events (SSE) via text/event-stream
- C) Long polling with 2-second intervals
- D) GraphQL subscriptions
> **B)** The chat handler in `server/src/handlers/chat/chat.ts` sets `Content-Type: text/event-stream` and writes SSE events (`tool_start`, `tool_result`, `assistant`, `done`, `error`). The frontend reads the stream using `res.body.getReader()` and a `TextDecoder`.
[difficulty:medium]

---

**Q10. Which library manages all server state on the frontend?**
? This is the primary data-fetching library used throughout the frontend.
- A) Redux Toolkit
- B) Zustand
- C) SWR
- D) TanStack Query (React Query)
> **D)** TanStack Query (`@tanstack/react-query` v5) manages all server state. The app uses `useQuery` for fetching (trips, messages, auth, preferences) and `useMutation` for mutations (trip deletion with optimistic updates).
[difficulty:easy]

---

**Q11. What happens when the AgentOrchestrator encounters a tool execution error?**
? Look at the try/catch block inside the tool execution loop in AgentOrchestrator.ts.
- A) The entire agent loop throws and terminates
- B) The error is caught, logged, and the error message is sent back to Claude as an is_error tool result
- C) The tool is retried up to 3 times
- D) The error is silently ignored and the loop continues
> **B)** When a tool throws, the error is caught, `isError` is set to true, and the result is set to `"Error: {message}"`. The `toolResults` array entry includes `is_error: true`, which tells Claude the tool failed. Claude can then decide how to proceed (e.g., suggest alternatives).
[difficulty:medium]

---

**Q12. How does the `calculate_remaining_budget` tool differ from the other tools?**
? Consider what external resources each tool uses.
- A) It is the only asynchronous tool
- B) It is the only tool that modifies the database
- C) It is pure computation with no external API calls or database access
- D) It is the only tool that requires authentication
> **C)** The `calculateRemainingBudget` function in `budget.tool.ts` performs pure arithmetic on the provided inputs (total_budget, flight_cost, hotel_total_cost, experience_costs). It does not call any external API or touch the database. The system prompt explicitly tells Claude to "Always use this tool instead of doing math yourself."
[difficulty:medium]

---

**Q13. What is the purpose of the `normalizeCacheKey()` function?**
? This function is used before every Redis cache get/set operation.
- A) It encrypts the cache key for security
- B) It creates deterministic cache keys by lowercasing strings and sorting object keys
- C) It validates that the cache key does not exceed Redis key length limits
- D) It adds a timestamp to prevent stale cache hits
> **B)** `normalizeCacheKey()` in `cache.service.ts` sorts the parameter object keys alphabetically and lowercases string values, then produces `api_cache:{provider}:{endpoint}:{sorted_params_json}`. This ensures that `{city: "Paris", guests: 2}` and `{guests: 2, city: "PARIS"}` produce the same cache key.
[difficulty:medium]

---

**Q14. Why does the system prompt instruct Claude to call `update_trip` as its FIRST tool call?**
? Read the "CRITICAL: Persist Trip Details Immediately" section of the system prompt.
- A) To validate that the trip exists in the database
- B) Because the trip record starts with placeholder data ("Planning...") and needs real details persisted immediately
- C) To lock the trip record and prevent concurrent modifications
- D) To trigger a webhook notification to the user
> **B)** Trips are created with `destination: "Planning..."` and no dates or budget. The system prompt says: "The trip record starts with placeholder data. Your #1 priority before doing any searches is to call update_trip to persist details the user has stated."
[difficulty:medium]

---

**Q15. How does the `SelectableCardGroup` component handle user selections?**
? Look at the component's state management and the confirm flow.
- A) It uses radio buttons with a form submission
- B) Cards are clickable buttons that toggle selection; a "Confirm Selection" button finalizes the choice and sends a message to the agent
- C) It uses drag-and-drop to rank preferences
- D) It auto-selects the cheapest option and requires the user to change it
> **B)** `SelectableCardGroup` maintains a `selectedId` state. Clicking a card toggles selection. When a card is selected, a "Confirm Selection" button appears. Clicking it calls `onConfirm(item.label)`, which in the `ChatBox` sends a message like "I've selected this flight: {label}. Book it and move on to searching for hotels."
[difficulty:medium]

---

**Q16. What query key pattern does TanStack Query use for trip-specific messages?**
? Look at the useQuery call in ChatBox.tsx.
- A) ["chat", tripId]
- B) ["messages", tripId]
- C) ["trips", tripId, "messages"]
- D) ["conversation", tripId]
> **B)** In `ChatBox.tsx`, the messages query uses `queryKey: ["messages", tripId]` and fetches from `/trips/${tripId}/messages`.
[difficulty:easy]

---

**Q17. How does the `TripDetailsForm` component detect when to render inside a chat message?**
? The parseTripFormFields function analyzes assistant message content.
- A) The assistant sends a special JSON payload with form fields
- B) The ChatBox checks for a metadata flag on the message object
- C) The `parseTripFormFields()` function scans for consecutive numbered list items containing keywords like "origin", "budget", "travel dates", and "travelers"
- D) The backend adds a `form_required: true` field to assistant messages
> **C)** `parseTripFormFields()` in `TripDetailsForm.tsx` finds consecutive numbered list lines (`/^\d+\.\s/`), then checks each line for keywords like "origin", "budget", "travel dates", "traveler". If at least 2 fields match, it returns the fields and surrounding text, and `ChatBox` renders the form inline.
[difficulty:hard]

---

**Q18. What is the relationship between the `conversations` and `trips` tables?**
? Look at the getOrCreateConversation function in the conversations repository.
- A) Many conversations per trip
- B) One-to-one: one conversation per trip, enforced by UPSERT on trip_id
- C) Conversations are independent of trips
- D) Trips reference conversations via a foreign key
> **B)** `getOrCreateConversation()` uses `INSERT INTO conversations (trip_id) VALUES ($1) ON CONFLICT (trip_id) DO UPDATE SET updated_at = NOW()`. This enforces a 1:1 relationship -- each trip has exactly one conversation.
[difficulty:medium]

---

**Q19. How many cities does the `get_destination_info` tool support?**
? Count the entries in the CITY_DATABASE lookup table.
- A) 10
- B) 18
- C) 24
- D) 50
> **C)** The `CITY_DATABASE` in `destination.tool.ts` contains 24 entries: New York, Los Angeles, San Francisco, Chicago, Miami, Barcelona, Paris, London, Rome, Berlin, Amsterdam, Tokyo, Bangkok, Sydney, Dubai, Singapore, Hong Kong, Lisbon, Istanbul, Mexico City, Cancun, Buenos Aires, Seoul, and Madrid.
[difficulty:easy]

---

**Q20. What happens when an authenticated user navigates to the landing page?**
? Look at the useEffect in the Home component (page.tsx).
- A) They see the landing page normally
- B) They are automatically redirected to /trips via router.replace
- C) They see a "Welcome back" banner
- D) They are redirected to their most recent trip
> **B)** The `Home` component in `web-client/src/app/page.tsx` has a `useEffect` that checks `if (user) { router.replace("/trips") }`. Logged-in users skip the landing page entirely.
[difficulty:easy]

---

**Q21. How does the login handler prevent session accumulation for a user?**
? Look at the loginUser function in the auth repository.
- A) Sessions expire automatically after a timeout
- B) It deletes all existing sessions for the user before creating a new one, inside a transaction
- C) It limits users to 3 concurrent sessions
- D) Old sessions are cleaned up by a background cron job
> **B)** `loginUser()` in `auth.ts` uses `withTransaction` to first `DELETE FROM sessions WHERE user_id = $1`, then `createSession(userId, client)`. This ensures each user has exactly one active session after login.
[difficulty:medium]

---

**Q22. What does the `InlineBudgetBar` component display when the user is over budget?**
? Look at the overBudget logic in InlineBudgetBar.tsx.
- A) A red warning modal
- B) A progress bar at 100% width with an "over" CSS class and text showing the overage amount
- C) The bar disappears and shows a text warning
- D) The bar turns yellow and pulses
> **B)** When `allocated > total`, the component sets `overBudget = true`, caps the bar width at 100%, adds the `styles.over` CSS class to both the fill and the remaining label, and displays the absolute overage amount with "over" text instead of "remaining".
[difficulty:medium]

---

**Q23. What is the purpose of the `ToolContext` interface in the tool executor?**
? Look at how update_trip uses context in executor.ts.
- A) It provides API keys for external services
- B) It carries tripId and userId so tools like update_trip can authorize database writes
- C) It configures the cache TTL for each tool
- D) It tracks which tools have already been called this turn
> **B)** `ToolContext` has two fields: `tripId` and `userId`. The `update_trip` case in `executeTool()` requires context to call `updateTrip(context.tripId, context.userId, input)`, ensuring the update is scoped to the correct trip and authorized user.
[difficulty:medium]

---

**Q24. How does the `QuickReplyChips` component decide which chips to show?**
? The parseQuickReplies function analyzes the assistant's last message.
- A) The backend sends a list of suggested replies
- B) It always shows "Yes" and "No" buttons
- C) `parseQuickReplies()` checks if the text ends with "?" and matches patterns like "Would you like", "Shall I", or "X or Y?" to generate contextual chips
- D) It shows chips based on the current trip status
> **C)** `parseQuickReplies()` returns `null` if the text does not end with `?`. If it matches patterns like `/would you like/i`, `/shall i/i`, `/do you want/i`, it returns `["Yes, please", "No thanks"]`. If it matches an "X or Y?" pattern, it returns the two options as separate chips.
[difficulty:hard]

---

**Q25. How does the frontend handle optimistic updates when deleting a trip?**
? Look at the deleteMutation in the trips list page.
- A) It waits for the server response before updating the UI
- B) It uses useMutation's onMutate to cancel queries, cache the previous state, and immediately remove the trip from the query data; on error it rolls back
- C) It sets a loading state on the trip card
- D) It removes the trip from a local Zustand store
> **B)** The `deleteMutation` in `trips/page.tsx` uses TanStack Query's optimistic update pattern: `onMutate` cancels in-flight queries, saves the previous data, and filters out the deleted trip. `onError` restores the previous data. `onSettled` invalidates the query to ensure consistency.
[difficulty:medium]

---

**Q26. What is the role of the `MockChatBox` component?**
? It appears on the landing page inside the "See it in action" section.
- A) It provides a sandbox for testing the real chat API
- B) It renders a simulated chat demo on the landing page to show how the agent works, without making real API calls
- C) It is a fallback component for when the real ChatBox fails
- D) It mocks the chat API for unit tests
> **B)** `MockChatBox` is rendered in the "Demo" section of the landing page (`page.tsx`). It shows a simulated conversation to demonstrate the product to unauthenticated visitors.
[difficulty:easy]

---

**Q27. How does the Express server handle graceful shutdown?**
? Look at the startServer function in app.ts.
- A) It calls process.exit() immediately
- B) It closes the HTTP server, then ends the PostgreSQL pool, then exits
- C) It relies on the process manager (Railway) to handle shutdown
- D) It sets a "shutting down" flag and waits for in-flight requests to complete
> **B)** The `shutdown()` function in `app.ts` listens for `SIGTERM` and `SIGINT`, closes the HTTP server with `server.close()`, calls `pool.end()` to close PostgreSQL connections, then exits with code 0.
[difficulty:medium]

---

**Q28. Why does the `searchFlights` tool need IATA airport codes instead of city names?**
? Consider what the SerpApi Google Flights engine requires.
- A) IATA codes are shorter and save tokens
- B) The SerpApi Google Flights engine uses `departure_id` and `arrival_id` parameters that require IATA codes
- C) City names are ambiguous (e.g., Portland, OR vs Portland, ME)
- D) The database stores flights by IATA code
> **B)** The `searchFlights` function passes `departure_id: input.origin` and `arrival_id: input.destination` to SerpApi. These parameters expect IATA codes. The system prompt tells Claude: "If the user gives a city name, call get_destination_info first to resolve the IATA code."
[difficulty:medium]

---

**Q29. What is the BookingConfirmation component's three-stage flow?**
? Look at the stage state machine in BookingConfirmation.tsx.
- A) Select -> Pay -> Receipt
- B) Review (cost breakdown + confirm/cancel) -> Booking (spinner, 2.2s timeout) -> Confirmed (checkmark, 1.5s auto-dismiss)
- C) Cart -> Checkout -> Payment
- D) Preview -> Edit -> Save
> **B)** The component uses a `stage` state of `"review" | "booking" | "confirmed"`. Review shows the cost breakdown with Confirm/Cancel buttons. Clicking Confirm sets stage to "booking" which shows a spinner; after 2200ms it auto-transitions to "confirmed" which shows a checkmark; after 1500ms it calls `onConfirm()`.
[difficulty:hard]

---

**Q30. How does the CORS configuration determine which origins are allowed?**
? Look at server/src/config/corsConfig.ts.
- A) It allows all origins with a wildcard
- B) It reads the CORS_ORIGIN env var, splits on commas, and checks each request origin against the allowlist
- C) It only allows the Vercel deployment URL
- D) It uses a regex pattern to match any .vercel.app domain
> **B)** `corsConfig.ts` splits `process.env.CORS_ORIGIN` (defaulting to `"http://localhost:5173"`) on commas, trims whitespace, and stores the result as `allowedOrigins`. The CORS middleware checks `if (!origin || allowedOrigins.includes(origin))` -- requests with no origin (e.g., server-to-server) or matching origins pass; others are rejected.
[difficulty:medium]

---

**Q31. What database feature does the conversations table use to enforce one conversation per trip?**
? Look at the INSERT statement in getOrCreateConversation.
- A) A CHECK constraint
- B) A UNIQUE constraint on trip_id with ON CONFLICT DO UPDATE (UPSERT)
- C) A trigger that deletes old conversations
- D) Application-level validation only
> **B)** The `getOrCreateConversation()` function uses `INSERT INTO conversations (trip_id) VALUES ($1) ON CONFLICT (trip_id) DO UPDATE SET updated_at = NOW()`. The `ON CONFLICT` clause implies a unique constraint on `trip_id`, and the UPSERT pattern ensures idempotent creation.
[difficulty:medium]

---

**Q32. How does the frontend API client handle 204 No Content responses?**
? Look at the request function in web-client/src/lib/api.ts.
- A) It throws an error
- B) It returns an empty object
- C) It returns undefined cast as the generic type T
- D) It retries the request
> **C)** The `request()` function in `api.ts` checks `if (res.status === 204) { return undefined as T; }`. This handles endpoints like `POST /auth/logout` and `DELETE /trips/:id` that return no body.
[difficulty:medium]

---

**Q33. What is the purpose of the `tool_call_log` table?**
? Look at the onToolExecuted callback in agent.service.ts.
- A) It stores the tool definitions for dynamic loading
- B) It logs every tool execution for observability: tool name, input/result JSON, latency in milliseconds, cache hit status, and errors
- C) It tracks rate limits for external APIs
- D) It queues tools for async execution
> **B)** In `agent.service.ts`, the `onToolExecuted` callback calls `insertToolCallLog()` with `conversation_id`, `tool_name`, `tool_input_json`, `tool_result_json`, `latency_ms`, `cache_hit`, and `error`. This creates an audit trail of every tool the agent calls.
[difficulty:medium]

---

**Q34. How does the `parseTripFormFields` function determine the boundary between "before" text, form fields, and "after" text?**
? This function splits assistant content into three sections for mixed rendering.
- A) It looks for special delimiter markers like `---`
- B) It finds the first and last consecutive numbered list lines, extracts the list block as form fields, and returns everything before the list as "before" and everything after as "after"
- C) It uses regex to find a JSON block embedded in the text
- D) The backend marks sections with HTML comments
> **B)** The function iterates through lines, tracks `listStart` and `listEnd` indices for consecutive numbered list items (`/^\d+\.\s/`), then returns `{ before: lines[0..listStart], fields: parsed_keywords, after: lines[listEnd+1..end] }`. This allows the ChatBox to render text, then the form, then more text.
[difficulty:hard]

---

**Q35. What is the `ErrorBoundary` component's role in the application?**
? Look at how it is used in layout.tsx.
- A) It catches network errors from API calls
- B) It wraps the main content area in the root layout to catch React render errors and display a fallback UI instead of a blank screen
- C) It logs errors to Sentry
- D) It retries failed component renders
> **B)** In `layout.tsx`, the `ErrorBoundary` wraps `{children}` inside `<main>`. It is a React error boundary that catches unhandled errors during rendering and displays a fallback UI rather than crashing the entire page.
[difficulty:easy]

---

**Q36. Why does the New Trip page use a `useRef` for `creating`?**
? Look at the useEffect in web-client/src/app/(protected)/trips/new/page.tsx.
- A) To store the trip ID after creation
- B) To prevent React Strict Mode's double-invocation of useEffect from creating two trips
- C) To track the loading animation state
- D) To reference the form element
> **B)** React Strict Mode in development calls effects twice. Without the `creating.current` guard, two trips would be created. The `useRef` persists across renders without triggering re-renders, and the effect checks `if (creating.current) return` before proceeding.
[difficulty:hard]

---

**Q37. How does the system prompt handle user preferences for personalized recommendations?**
? Read the "User Preferences & Personalization" section of the system prompt.
- A) Preferences are ignored -- the agent treats all users the same
- B) Preferences are sent as separate tool inputs
- C) The system prompt instructs Claude to respect dietary restrictions, match activity pacing to intensity preference, and tailor recommendations to social style (solo, couple, group, family)
- D) Preferences are only used for hotel star rating filters
> **C)** The system prompt has detailed instructions for each preference dimension: dietary restrictions affect restaurant/food experience recommendations, intensity affects daily activity count (1-2 for relaxed, packed schedule for active), and social style affects recommendation type (walking tours for solo, romantic dining for couples, kid-friendly for families).
[difficulty:medium]

---

**Q38. What is the maximum request body size allowed by the Express server?**
? Look at the express.json() middleware configuration in app.ts.
- A) 1KB
- B) 10KB
- C) 100KB
- D) 1MB
> **B)** The server configures `express.json({ limit: "10kb" })` and `express.urlencoded({ extended: true, limit: "10kb" })`. This caps request bodies at 10 kilobytes to prevent large payload attacks.
[difficulty:easy]

---

**Q39. How does the `formatCurrency` utility handle performance for repeated calls with the same currency?**
? Look at web-client/src/lib/format.ts.
- A) It uses React.memo
- B) It caches Intl.NumberFormat instances in a Map keyed by currency code
- C) It uses a simple string template without formatting
- D) It delegates to a server-side formatting endpoint
> **B)** `formatCurrency` maintains a `formatterCache` Map. On the first call with a given currency, it creates an `Intl.NumberFormat` instance and caches it. Subsequent calls with the same currency reuse the cached formatter, avoiding the overhead of creating a new Intl object each time.
[difficulty:hard]

---

**Q40. How does the Dockerfile.server achieve a smaller production image?**
? Look at the multi-stage build in Dockerfile.server.
- A) It uses Alpine Linux
- B) It uses a multi-stage build: the first stage installs all dependencies and compiles TypeScript; the second stage installs only production dependencies and copies the compiled output
- C) It uses Docker layer caching only
- D) It excludes node_modules entirely and runs from source
> **B)** The Dockerfile has two stages. The `base` stage installs all dependencies (including devDependencies for TypeScript compilation) and runs `pnpm run build`. The `production` stage starts fresh from `node:22-slim`, installs only production dependencies (`--prod`), and copies just `server/dist` and `server/migrations` from the base stage.
[difficulty:hard]
