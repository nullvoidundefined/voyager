# Bugs

Track bugs here. Clear them in batches.

---

## Open

### B2: Claude still produces walls of text

Despite prompt constraints, Claude sometimes writes multi-paragraph responses. Per-category state machines are now implemented — monitor if this improves. May need further prompt iteration per category/status.

### B10: Homepage hero images have side gutters

Hero/feature images should be edge-to-edge with no side padding, max-width capped at 1600px.

### B11: Unsplash images not responsive to device size

Desktop-sized images (1600x800) load on mobile. Should use responsive Unsplash `w` parameter or Next.js `sizes` + `srcset` to serve appropriately sized assets per breakpoint.

### B12: Stale trip metadata after updates

Travel status, budget, and dates can appear invalid or stale after trip modifications. Need an end-to-end audit to ensure trip metadata stays in sync as the trip is modified via the chat agent.

### B13: Chat suggests alternatives when user names a specific option

When a user says "I want the InterContinental Plaza Hotel," Claude should book that exact option and confirm — not present alternatives. This applies across all bookable categories: hotels, cars, experiences, dining. The category prompts need to instruct Claude to honor explicit selections.

### B15: Header needs coral compass logo + favicon

The header logo is just text "Voyager". Needs a coral/orange compass SVG icon. Also need a matching favicon for the browser tab.

### B16: Trip tile image not clickable

On the trips list page, the image header on the trip card is not clickable — only the text below is. The entire card should be clickable.

### B17: Trip detail hero has rounded corners — should be square

The destination hero image on the trip detail page has border-radius. It should be fully square (no rounded corners) for edge-to-edge feel.

### B18: Itinerary items above chat — should be below

On the trip detail page, the itinerary items section is above the chat. The chat should be the first thing users see, with itinerary below.

### B19: Tool progress items have no gap between them

The loading/tool progress indicators in the chat have no spacing between them.

### B20: Double confirm buttons on flight tile selection

After selecting a flight in the tile list, a "Confirm Selection" button appears on the card group, but additional confirm buttons also appear below. The card group's confirm button should be the only one.

### B21: Hotel tiles missing prices

Many hotel tiles don't display prices. All hotels should show price_per_night and total_price.

### B22: Over-budget value shows NaN

When total_spent exceeds budget_total, the remaining budget displays NaN instead of a negative number.

### B23: Explore page needs search bar

The explore page should have a text search bar that filters destination cards by name, in addition to the category filters.

### B14: Tile selections don't persist to trip record

When a user selects a flight/hotel/car/experience from the tile cards, the selection sends a chat message ("I've selected...") but nothing persists to `trip_flights`, `trip_hotels`, `trip_car_rentals`, or `trip_experiences`. The trip detail page shows "No itinerary items" and "$0 allocated" because the selection tables are empty. Need selection persistence tools or a mechanism for Claude to call `update_trip` with the selected item data after the user confirms.

---

## Resolved

### B1: No typing animation for streaming text

Fixed: `flushHeaders()` after `writeHead()`, disabled socket timeout for SSE, added `X-Accel-Buffering: no` and `res.flush()` for real-time token delivery. Resolved 2026-04-03.

### B3: Tool progress indicators not visible during streaming

Fixed: reordered `finally` block to invalidate queries before clearing streaming state, preventing blank-gap flash. Resolved 2026-04-03.

### B4: ESLint config path doubling

Fixed: added `tsconfigRootDir: import.meta.dirname` to parserOptions. Resolved 2026-04-03.

### B5: total_spent always hardcoded to 0

Fixed: now derived from sum of selected flights, hotels, car rentals, and experiences. Resolved 2026-04-03.

### B6: selected_car_rentals always empty

Fixed: added `trip_car_rentals` join to `getTripWithDetails`, `TripCarRental` interface, wired through chat handler. Resolved 2026-04-03.

### B7: ExperienceCard uses raw $ instead of formatCurrency

Fixed: replaced with `formatCurrency(estimatedCost)`. Resolved 2026-04-03.

### B8: Duplicate city lookup tables

Fixed: consolidated `CITY_COORDS` and `CITY_DATABASE` into shared `server/src/data/cities.ts` with unified `CityData` interface and `lookupCity` function. Resolved 2026-04-03.

### B9: Mobile Safari login fails with "Authentication required"

Fixed: API proxied through Vercel rewrites (`/api/:path*` → Railway) for same-origin cookies. Changed `sameSite` to `'lax'`. Safari ITP no longer blocks the session cookie. Resolved 2026-04-03.

## Bug batch 2026-04-07

Batch IDs below (B1 through B6) are scoped to the 2026-04-07 fix batch on
branch `fix/bug-batch-2026-04-07`. They do not overlap with the historical
B1 through B23 entries above.

### B1: Trip detail Budget tile and Cost Breakdown render `$NaN`

severity: P1 effort: S - fixed 2026-04-07
Root cause: pg returned NUMERIC columns as strings, and the trip detail
page reduced over `c.total_price` without a `?? 0` defensive default.
Fix: registered a global pg.types parser for NUMERIC so currency
columns come back as numbers, plus a defensive `?? 0` and a
Number.isFinite guard on the frontend. Test in
`server/src/db/pool/pool.test.ts` and
`web-client/src/app/(protected)/trips/[id]/page.test.tsx`. Commit 3b50361.

### B2: Car rental tool throws and the agent narrates "having trouble accessing"

severity: P1 effort: M - fixed 2026-04-07
Root cause: `searchCarRentals` did not catch SerpApi errors, so any
upstream failure threw to the executor and the agent improvised a
fallback narration. Fix: wrap the SerpApi call in try/catch and
return `{ rentals: [], error }` instead. Updated tool description to
make the no-results path explicit. Commit d8c363a.

### B3: ToolProgressIndicator chips have no gap and look broken

severity: P2 effort: M - fixed 2026-04-07
Root cause: per-tool chip rendering with no margin between chips and a
duplicate "Done" label. Fix: replaced the chip stack with a single
ChatProgressBar widget that collapses adjacent tool_progress nodes
into one determinate progress bar. Locked with invariant 6. Commit 990b30c.

### B4: Chat appears dead between submit and first stream chunk

severity: P2 effort: S - fixed 2026-04-07
Root cause: no UI feedback during the gap between the user sending a
message and the first SSE event arriving. Fix: render an indeterminate
ChatProgressBar with the label "Thinking" while isSending is true and
no streaming nodes have arrived yet. Locked with invariant 7. Commit 6bfa8b4.

### B5: No gap between chat box and Flights section

severity: P3 effort: S - fixed 2026-04-07
Root cause: missing margin-bottom on `.chatSection` in the trip detail
SCSS module. Fix: 48px bottom margin (and matching `.itinerary` top
margin) plus a Playwright computed-style assertion that the visible
gap is at least 32 pixels. Commits 029e2e7, d43f929, f819b46.

### B6: "Book This Trip" / "Try Again" buttons are huge and intrusive

severity: P2 effort: M - fixed 2026-04-07
Root cause: the booking actions UI was a sticky two-button bar with
oversized buttons and no gutter from the input. Fix: replaced with an
inline BookingPrompt tile rendered as the last assistant message in
the chat stream. Conditional chips show only what is missing from the
trip. Locked with invariant 8. Commit c264b75.
