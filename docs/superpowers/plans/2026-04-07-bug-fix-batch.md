# 2026-04-07 Bug Fix Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six user-reported bugs (B1 through B6) on the Voyager trip detail page and chat box, test-first, one commit per bug ID.

**Architecture:** Each bug is fixed in isolation with its own commit. B1 fixes a `pg` numeric-to-string coercion at the database boundary plus a defensive frontend guard. B2 makes the car rental tool fail soft. B3 introduces a new `ChatProgressBar` widget that consolidates `tool_progress` nodes. B4 reuses that widget in indeterminate mode for an immediate "Thinking" indicator. B5 is a Playwright snapshot for chat-itinerary spacing. B6 introduces a client-only `booking_prompt` virtual node rendered as an inline assistant message.

**Tech Stack:** Next.js 15 + React 18, TypeScript 5, Vitest + React Testing Library (frontend), Vitest (server), Playwright (E2E), Express 5, `pg`, SCSS modules, `@voyager/shared-types` package.

**Spec:** `docs/superpowers/specs/2026-04-07-bug-fix-batch-design.md`

---

## File Structure

### Files created

| Path                                                                    | Responsibility                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `web-client/src/components/ChatBox/widgets/ChatProgressBar.tsx`         | New consolidated progress bar (determinate + indeterminate modes)     |
| `web-client/src/components/ChatBox/widgets/ChatProgressBar.module.scss` | Styles for the progress bar                                           |
| `web-client/src/components/ChatBox/widgets/ChatProgressBar.test.tsx`    | Component tests for the progress bar                                  |
| `web-client/src/components/ChatBox/nodes/BookingPrompt.tsx`             | Inline assistant-style booking prompt tile (client-only virtual node) |
| `web-client/src/components/ChatBox/nodes/BookingPrompt.module.scss`     | Styles for the booking prompt tile                                    |
| `web-client/src/components/ChatBox/nodes/BookingPrompt.test.tsx`        | Component tests for the booking prompt                                |
| `web-client/src/app/(protected)/trips/[id]/page.test.tsx`               | Frontend test for B1 NaN regression                                   |
| `e2e/trip-page-spacing.spec.ts`                                         | Playwright snapshot test for B5 chat-itinerary spacing                |

### Files modified

| Path                                                               | Change                                                                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/db/pool/pool.ts`                                       | Register a global `pg.types` parser to coerce `NUMERIC` columns to JavaScript `number`                                                  |
| `server/src/db/pool/pool.test.ts` (or new)                         | Test that NUMERIC columns return as `number`                                                                                            |
| `server/src/tools/car-rentals.tool.ts`                             | Wrap SerpApi call in try/catch, return `{ rentals: [], error }` on failure                                                              |
| `server/src/tools/car-rentals.tool.test.ts`                        | Add three new tests for the fail-soft behavior                                                                                          |
| `server/src/tools/definitions.ts`                                  | Update `search_car_rentals` description so the agent knows no-results is a first-class outcome                                          |
| `web-client/src/app/(protected)/trips/[id]/page.tsx`               | Add `?? 0` to car rentals reduce, wrap allocated/remaining in `Number.isFinite` guards                                                  |
| `web-client/src/app/(protected)/trips/[id]/tripDetail.module.scss` | Add `margin-top` to itinerary section (B5)                                                                                              |
| `web-client/src/components/ChatBox/ChatBox.tsx`                    | Append `pending` indicator on send (B4); remove old `bookingActions` block, append `booking_prompt` virtual node when criteria met (B6) |
| `web-client/src/components/ChatBox/ChatBox.module.scss`            | Delete `.bookingActions`, `.bookButton`, `.tryAgainButton` rules (B6)                                                                   |
| `web-client/src/components/ChatBox/NodeRenderer.tsx`               | Replace `tool_progress` case with consolidated render (B3); add new `booking_prompt` case (B6)                                          |
| `web-client/src/components/ChatBox/VirtualizedChat.tsx`            | Collapse adjacent `tool_progress` nodes into one ChatProgressBar render (B3)                                                            |
| `web-client/src/components/ChatBox/ChatBox.invariants.test.tsx`    | Add invariants 6 (consolidated progress bar), 7 (pending indicator), 8 (booking prompt)                                                 |
| `packages/shared-types/src/nodes.ts`                               | Add `booking_prompt` virtual node type to `ChatNode` union (B6)                                                                         |
| `docs/BUGS.md`                                                     | Append B1 through B6 entries with severity/effort tags                                                                                  |
| `docs/audits/2026-04-07-triage.md`                                 | Mirror P1 entries (B1, B2) per global rule                                                                                              |

### Files deleted

| Path                                                                        | Reason                           |
| --------------------------------------------------------------------------- | -------------------------------- |
| `web-client/src/components/ChatBox/nodes/ToolProgressIndicator.tsx`         | Replaced by ChatProgressBar (B3) |
| `web-client/src/components/ChatBox/nodes/ToolProgressIndicator.module.scss` | Replaced by ChatProgressBar (B3) |

---

## Pre-flight: Working branch

- [ ] **Step 0.1: Confirm working branch**

Run: `git status && git branch --show-current`
Expected: clean working tree, branch is `main` (or a fresh feature branch).

If the user wants a feature branch instead of main, create it before starting:

```bash
git checkout -b fix/bug-batch-2026-04-07
```

---

## Task 1: B1 — Fix NaN in Budget tile and Cost Breakdown

**Files:**

- Create: `server/src/db/pool/pool.test.ts` (if not present)
- Create: `web-client/src/app/(protected)/trips/[id]/page.test.tsx`
- Modify: `server/src/db/pool/pool.ts`
- Modify: `web-client/src/app/(protected)/trips/[id]/page.tsx`

### Subtask 1A: Server-side NUMERIC parser

- [ ] **Step 1.1: Write the failing test**

Create or extend `server/src/db/pool/pool.test.ts`. Append:

```typescript
import pg from 'pg';
import { describe, expect, it } from 'vitest';

import './pool.js';

// ensure side-effect type-parser registration runs

describe('pg NUMERIC type parser', () => {
  it('parses NUMERIC OID values into JavaScript number, not string', () => {
    const numericOid = pg.types.builtins.NUMERIC;
    const parser = pg.types.getTypeParser(numericOid);
    expect(parser('150.00')).toBe(150);
    expect(typeof parser('150.00')).toBe('number');
  });

  it('parses NUMERIC null sentinel into 0 only when input is non-null', () => {
    const numericOid = pg.types.builtins.NUMERIC;
    const parser = pg.types.getTypeParser(numericOid);
    expect(parser('0')).toBe(0);
    expect(parser('1234.56')).toBe(1234.56);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run from `server/`:

```bash
pnpm test pool.test.ts
```

Expected: FAIL. Default `pg` parser returns `'150.00'` as a string. Test asserts `typeof === 'number'`, fails.

- [ ] **Step 1.3: Implement the parser registration**

Edit `server/src/db/pool/pool.ts`. After the existing `import pg from 'pg';` line and before `const { Pool } = pg;`, add:

```typescript
// Coerce Postgres NUMERIC columns to JavaScript numbers at the boundary.
// Default pg behavior returns NUMERIC as a string (because numeric is
// arbitrary-precision and JS number cannot losslessly represent all
// values). Voyager's NUMERIC columns are bounded currency amounts, so
// the precision risk is acceptable in exchange for safe arithmetic.
// Without this, sums like `0 + "150.00"` produce string concat or NaN
// downstream, which is how the Budget tile rendered "$NaN allocated".
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (val) => parseFloat(val));
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `pnpm test pool.test.ts`
Expected: PASS.

### Subtask 1B: Frontend defensive guard

- [ ] **Step 1.5: Write the failing test**

Create `web-client/src/app/(protected)/trips/[id]/page.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TripDetailPage from './page';

// Mock next/navigation useParams
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'trip-1' }),
}));

// Mock the API client to return a fixture trip
vi.mock('@/lib/api', () => ({
  get: vi.fn().mockResolvedValue({
    trip: {
      id: 'trip-1',
      destination: 'Beijing',
      origin: 'SFO',
      departure_date: '2026-08-01',
      return_date: '2026-08-08',
      budget_total: 10000,
      budget_currency: 'USD',
      travelers: 1,
      status: 'planning',
      flights: [
        {
          id: 'f1',
          origin: 'SFO',
          destination: 'PEK',
          airline: 'Asiana',
          flight_number: 'OZ211',
          price: 1010,
          currency: 'USD',
          departure_time: '2026-08-01T18:30:00',
        },
      ],
      hotels: [
        {
          id: 'h1',
          name: 'Hotel A',
          city: 'Beijing',
          price_per_night: 158,
          total_price: 1105,
          currency: 'USD',
          check_in: '2026-08-01',
          check_out: '2026-08-08',
        },
      ],
      // Critical fixture: car_rentals row with null total_price.
      // Reproduces B1 — Budget tile showed "$NaN allocated" because
      // the trip detail page reduced over `c.total_price` without ?? 0,
      // and at least one row had a null total_price.
      car_rentals: [
        {
          id: 'cr1',
          provider: 'Hertz',
          car_name: 'Toyota',
          car_type: 'compact',
          total_price: null as unknown as number,
          currency: 'USD',
        },
      ],
      experiences: [],
    },
  }),
  put: vi.fn(),
}));

// Mock ChatBox to keep this test focused on the budget render path
vi.mock('@/components/ChatBox/ChatBox', () => ({
  ChatBox: () => <div>chat</div>,
}));
vi.mock('@/components/BookingConfirmation/BookingConfirmation', () => ({
  BookingConfirmation: () => null,
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TripDetailPage />
    </QueryClientProvider>,
  );
}

describe('TripDetailPage budget rendering (B1 regression)', () => {
  it('never renders $NaN in the Budget tile when a car rental row has null total_price', async () => {
    renderPage();
    // Wait for the trip to load
    expect(await screen.findByText(/allocated/)).toBeInTheDocument();
    // Body of the document should not contain "NaN" anywhere.
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('never renders $NaN in the Cost Breakdown Remaining row', async () => {
    renderPage();
    expect(await screen.findByText(/Remaining/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NaN');
  });
});
```

- [ ] **Step 1.6: Run test to verify it fails**

Run from `web-client/`:

```bash
pnpm test page.test.tsx
```

Expected: FAIL. Both assertions trip — "NaN" appears in the rendered output because `0 + null = NaN` in the `carRentalTotal` reduce.

- [ ] **Step 1.7: Apply the frontend fix**

Edit `web-client/src/app/(protected)/trips/[id]/page.tsx` lines 126 to 142. Replace:

```tsx
const flightTotal = trip.flights.reduce((sum, f) => sum + (f.price ?? 0), 0);
const hotelTotal = trip.hotels.reduce(
  (sum, h) => sum + (h.total_price ?? 0),
  0,
);
const carRentalTotal = trip.car_rentals.reduce(
  (sum, c) => sum + c.total_price,
  0,
);
const experienceTotal = trip.experiences.reduce(
  (sum, e) => sum + (e.estimated_cost ?? 0),
  0,
);
const allocated = flightTotal + hotelTotal + carRentalTotal + experienceTotal;
const remaining =
  trip.budget_total != null ? trip.budget_total - allocated : null;
```

with:

```tsx
const flightTotal = trip.flights.reduce((sum, f) => sum + (f.price ?? 0), 0);
const hotelTotal = trip.hotels.reduce(
  (sum, h) => sum + (h.total_price ?? 0),
  0,
);
const carRentalTotal = trip.car_rentals.reduce(
  (sum, c) => sum + (c.total_price ?? 0),
  0,
);
const experienceTotal = trip.experiences.reduce(
  (sum, e) => sum + (e.estimated_cost ?? 0),
  0,
);
const rawAllocated =
  flightTotal + hotelTotal + carRentalTotal + experienceTotal;
// Defensive: if any upstream value slipped through as a string or NaN
// despite the pg numeric parser, fall back to 0 rather than rendering
// "$NaN" to the user. See docs/BUGS.md B1.
const allocated = Number.isFinite(rawAllocated) ? rawAllocated : 0;
const rawRemaining =
  trip.budget_total != null ? trip.budget_total - allocated : null;
const remaining =
  rawRemaining != null && Number.isFinite(rawRemaining) ? rawRemaining : null;
```

Also update the `TripCarRental` interface in the same file (around line 43) to allow `null`:

```tsx
interface TripCarRental {
  id: string;
  provider: string;
  car_name: string;
  car_type: string;
  total_price: number | null;
  currency: string;
}
```

- [ ] **Step 1.8: Run test to verify it passes**

Run: `pnpm test page.test.tsx`
Expected: PASS, both assertions.

- [ ] **Step 1.9: Run the full verification chain**

From the repo root:

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 1.10: Commit B1**

```bash
git add server/src/db/pool/pool.ts \
        server/src/db/pool/pool.test.ts \
        web-client/src/app/\(protected\)/trips/\[id\]/page.tsx \
        web-client/src/app/\(protected\)/trips/\[id\]/page.test.tsx
git commit -m "$(cat <<'EOF'
fix(B1): coerce trip detail numeric columns and guard NaN

Register a global pg.types parser for NUMERIC OID so currency
columns come back as JavaScript numbers instead of strings. Add a
defensive ?? 0 on the trip detail car rentals reduce and wrap
allocated/remaining in Number.isFinite guards so the UI never
renders "$NaN" again. Includes a server pool test that asserts the
parser returns numbers and a frontend page test that renders a
fixture trip with a null car rental total_price and asserts NaN
never appears.
EOF
)"
```

---

## Task 2: B2 — Make car rental tool fail soft

**Files:**

- Modify: `server/src/tools/car-rentals.tool.ts`
- Modify: `server/src/tools/car-rentals.tool.test.ts`
- Modify: `server/src/tools/definitions.ts`

- [ ] **Step 2.1: Write the failing tests**

Open `server/src/tools/car-rentals.tool.test.ts` and append three new `it()` blocks inside the existing `describe('searchCarRentals', () => { ... })`:

```typescript
it('returns { rentals: [], error } when SerpApi throws', async () => {
  vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
  vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(
    new Error('SerpApi 500: engine not supported for region'),
  );

  const result = await searchCarRentals({
    pickup_location: 'Beijing',
    pickup_date: '2026-08-01',
    dropoff_date: '2026-08-08',
  });

  expect(result.rentals).toEqual([]);
  expect(result.error).toContain('engine not supported');
});

it('does not throw when SerpApi throws', async () => {
  vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
  vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(
    new Error('Network ECONNRESET'),
  );

  // The function MUST resolve, never reject.
  await expect(
    searchCarRentals({
      pickup_location: 'Beijing',
      pickup_date: '2026-08-01',
      dropoff_date: '2026-08-08',
    }),
  ).resolves.toBeDefined();
});

it('does not cache failed responses', async () => {
  vi.mocked(cacheService.cacheGet).mockResolvedValueOnce(null);
  vi.mocked(serpApiService.serpApiGet).mockRejectedValueOnce(
    new Error('SerpApi 503'),
  );

  await searchCarRentals({
    pickup_location: 'Beijing',
    pickup_date: '2026-08-01',
    dropoff_date: '2026-08-08',
  });

  expect(cacheService.cacheSet).not.toHaveBeenCalled();
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run from `server/`:

```bash
pnpm test car-rentals.tool.test.ts
```

Expected: FAIL on all three new tests. Current implementation throws synchronously.

- [ ] **Step 2.3: Apply the fix**

Edit `server/src/tools/car-rentals.tool.ts`. Change the function signature and wrap the SerpApi call in try/catch.

Replace the `searchCarRentals` function (line 73 to end) with:

```typescript
export async function searchCarRentals(
  input: CarRentalInput,
): Promise<{ rentals: CarRentalResult[]; error?: string }> {
  // Mock mode for eval runs
  if (isMockMode()) {
    return generateMockCarRentals(input);
  }

  const cacheKey = normalizeCacheKey('serpapi', 'google-car-rental', {
    pickupLocation: input.pickup_location,
    pickupDate: input.pickup_date,
    dropoffDate: input.dropoff_date,
    dropoffLocation: input.dropoff_location,
    carType: input.car_type,
  });

  const cached = await cacheGet<{ rentals: CarRentalResult[] }>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, 'Car rental search cache hit');
    return cached;
  }

  const params: Record<string, string | number | undefined> = {
    pickup_location: input.pickup_location,
    pickup_date: input.pickup_date,
    dropoff_date: input.dropoff_date,
    dropoff_location: input.dropoff_location,
    hl: 'en',
    currency: 'USD',
  };

  let response: SerpApiCarRentalResponse;
  try {
    response = (await serpApiGet(
      'google_car_rental',
      params,
    )) as SerpApiCarRentalResponse;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn(
      { err, pickup_location: input.pickup_location },
      'Car rental search failed; returning empty result',
    );
    return { rentals: [], error: errorMessage };
  }

  const carsResults = response.cars_results ?? [];
  const rentals = carsResults
    .slice(0, 5)
    .map((car) => normalizeCarRental(car, input));

  const result = { rentals };
  await cacheSet(cacheKey, result, CACHE_TTL);
  logger.info(
    { count: rentals.length, pickup_location: input.pickup_location },
    'Car rental search complete',
  );

  return result;
}
```

- [ ] **Step 2.4: Update the tool description**

Open `server/src/tools/definitions.ts` and locate the `search_car_rentals` definition. Update its `description` field to include explicit no-results guidance. Find the existing description string and append:

```
If the result has empty `rentals` and an `error` field, the search did not succeed for this destination. Tell the user "no car rentals available for this destination" and offer alternatives like taxis, public transit, or arranging rental independently. Do NOT say you are "having trouble accessing" results.
```

If you cannot find the exact line, run:

```bash
pnpm exec rg -n "search_car_rentals" server/src/tools/definitions.ts
```

to locate it, then edit in place.

- [ ] **Step 2.5: Run tests to verify they pass**

Run: `pnpm test car-rentals.tool.test.ts`
Expected: all eleven tests pass (eight existing plus three new).

- [ ] **Step 2.6: Run the full verification chain**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 2.7: Commit B2**

```bash
git add server/src/tools/car-rentals.tool.ts \
        server/src/tools/car-rentals.tool.test.ts \
        server/src/tools/definitions.ts
git commit -m "$(cat <<'EOF'
fix(B2): make car rental tool fail soft

Wrap the SerpApi call in try/catch and return { rentals: [], error }
on failure instead of throwing. Update the tool description so the
agent narrates "no rentals available" rather than improvising "I am
having trouble accessing." Adds three tests covering: error returns
empty rentals with error field, function never rejects, failed
responses are not cached.
EOF
)"
```

---

## Task 3: B3 — Consolidate ToolProgressIndicator into ChatProgressBar

**Files:**

- Create: `web-client/src/components/ChatBox/widgets/ChatProgressBar.tsx`
- Create: `web-client/src/components/ChatBox/widgets/ChatProgressBar.module.scss`
- Create: `web-client/src/components/ChatBox/widgets/ChatProgressBar.test.tsx`
- Modify: `web-client/src/components/ChatBox/VirtualizedChat.tsx`
- Modify: `web-client/src/components/ChatBox/NodeRenderer.tsx`
- Modify: `web-client/src/components/ChatBox/ChatBox.invariants.test.tsx`
- Delete: `web-client/src/components/ChatBox/nodes/ToolProgressIndicator.tsx`
- Delete: `web-client/src/components/ChatBox/nodes/ToolProgressIndicator.module.scss`

### Subtask 3A: New ChatProgressBar widget

- [ ] **Step 3.1: Write the failing test**

Create `web-client/src/components/ChatBox/widgets/ChatProgressBar.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatProgressBar } from './ChatProgressBar';

afterEach(cleanup);

describe('ChatProgressBar', () => {
  it('renders a progressbar with aria-valuenow=0 when no tools done', () => {
    render(
      <ChatProgressBar
        mode='determinate'
        done={0}
        total={3}
        latestLabel='Searching flights'
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/Searching flights/)).toBeInTheDocument();
  });

  it('renders aria-valuenow=66 when 2 of 3 tools done', () => {
    render(
      <ChatProgressBar
        mode='determinate'
        done={2}
        total={3}
        latestLabel='Searching hotels'
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '66');
  });

  it('renders aria-valuenow=100 and "Done" label when all tools done', () => {
    render(
      <ChatProgressBar
        mode='determinate'
        done={3}
        total={3}
        latestLabel='Assembling response'
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });

  it('renders an indeterminate bar with no aria-valuenow in indeterminate mode', () => {
    render(<ChatProgressBar mode='indeterminate' label='Thinking' />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
  });

  it('renders exactly one progressbar element regardless of mode', () => {
    const { rerender } = render(
      <ChatProgressBar mode='determinate' done={1} total={2} latestLabel='X' />,
    );
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);

    rerender(<ChatProgressBar mode='indeterminate' label='Y' />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run from `web-client/`:

```bash
pnpm test ChatProgressBar.test.tsx
```

Expected: FAIL — `ChatProgressBar` does not exist.

- [ ] **Step 3.3: Implement ChatProgressBar.tsx**

Create `web-client/src/components/ChatBox/widgets/ChatProgressBar.tsx`:

```tsx
import styles from './ChatProgressBar.module.scss';

type ChatProgressBarProps =
  | {
      mode: 'determinate';
      done: number;
      total: number;
      latestLabel: string;
    }
  | {
      mode: 'indeterminate';
      label: string;
    };

export function ChatProgressBar(props: ChatProgressBarProps) {
  if (props.mode === 'indeterminate') {
    return (
      <div className={styles.wrapper}>
        <div
          className={`${styles.track} ${styles.indeterminate}`}
          role='progressbar'
          aria-label={props.label}
        >
          <div className={styles.indeterminateFill} />
        </div>
        <div className={styles.label}>
          <span>{props.label}…</span>
        </div>
      </div>
    );
  }

  const { done, total, latestLabel } = props;
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.min(100, Math.round((done / safeTotal) * 100));
  const isComplete = done >= total;
  const text = isComplete ? 'Done' : `${latestLabel}…`;

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.track}
        role='progressbar'
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={text}
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.label}>
        <span>{text}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.4: Implement ChatProgressBar.module.scss**

Create `web-client/src/components/ChatBox/widgets/ChatProgressBar.module.scss`:

```scss
.wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 0;
  width: 100%;
  max-width: 360px;
}

.track {
  position: relative;
  height: 6px;
  width: 100%;
  background: var(--border-light);
  border-radius: 999px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.3s var(--ease-out);
}

.indeterminate {
  background: var(--border-light);
}

.indeterminateFill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 30%;
  background: var(--accent);
  border-radius: 999px;
  animation: indeterminate-slide 1.4s var(--ease-out) infinite;
}

@keyframes indeterminate-slide {
  0% {
    left: -30%;
  }
  100% {
    left: 100%;
  }
}

.label {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--foreground-muted);
  line-height: 1.4;
}
```

- [ ] **Step 3.5: Run tests to verify they pass**

Run: `pnpm test ChatProgressBar.test.tsx`
Expected: all 5 tests pass.

### Subtask 3B: Wire ChatProgressBar into VirtualizedChat (collapse tool_progress nodes)

- [ ] **Step 3.6: Write the failing invariants test**

Open `web-client/src/components/ChatBox/ChatBox.invariants.test.tsx`. Append a new `describe` block AFTER the existing `invariant 5` block, BEFORE the closing of the outer `describe('ChatBox invariants', ...)`:

```tsx
describe('invariant 6: tool_progress nodes collapse into one progress bar', () => {
  it('renders exactly one progressbar element when an assistant message has multiple tool_progress nodes', () => {
    const assistantWithToolProgress = makeAssistantMessage('msg-1', [
      {
        type: 'tool_progress',
        tool_name: 'search_flights',
        tool_id: 't1',
        status: 'done',
      },
      {
        type: 'tool_progress',
        tool_name: 'search_hotels',
        tool_id: 't2',
        status: 'done',
      },
      {
        type: 'tool_progress',
        tool_name: 'search_experiences',
        tool_id: 't3',
        status: 'running',
      },
    ]);

    render(
      <VirtualizedChat
        messages={[assistantWithToolProgress]}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending
        onQuickReply={noop}
      />,
    );

    // Exactly one progressbar element, not three chips.
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    // The latest running tool's label is the one rendered.
    expect(screen.getByText(/Finding experiences/)).toBeInTheDocument();
  });

  it('renders the progressbar at 100% when all tool_progress nodes are done', () => {
    const allDone = makeAssistantMessage('msg-1', [
      {
        type: 'tool_progress',
        tool_name: 'search_flights',
        tool_id: 't1',
        status: 'done',
      },
      {
        type: 'tool_progress',
        tool_name: 'search_hotels',
        tool_id: 't2',
        status: 'done',
      },
    ]);

    render(
      <VirtualizedChat
        messages={[allDone]}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending={false}
        onQuickReply={noop}
      />,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
});
```

- [ ] **Step 3.7: Run the failing test**

Run from `web-client/`:

```bash
pnpm test ChatBox.invariants.test.tsx
```

Expected: invariant 6 tests FAIL — there are still N `ToolProgressIndicator` chips, no `progressbar` role yet.

- [ ] **Step 3.8: Update NodeRenderer to use ChatProgressBar for tool_progress**

Edit `web-client/src/components/ChatBox/NodeRenderer.tsx`. Change the import:

Replace:

```tsx
import { ToolProgressIndicator } from './nodes/ToolProgressIndicator';
```

with nothing (delete the line). The `tool_progress` node case will be removed; collapse happens in `VirtualizedChat`. Replace the `case 'tool_progress':` block with:

```tsx
    case 'tool_progress':
      // Rendered as part of a consolidated ChatProgressBar by VirtualizedChat.
      // Returning null here prevents per-node chip rendering. See invariant 6.
      return null;
```

- [ ] **Step 3.9: Update VirtualizedChat to render ChatProgressBar from collapsed tool_progress nodes**

Edit `web-client/src/components/ChatBox/VirtualizedChat.tsx`. Add the import at the top:

```tsx
import { ChatProgressBar } from './widgets/ChatProgressBar';
```

Then update the inner message render block (the `<div className={styles.bubble}>`) to detect any `tool_progress` nodes in `message.nodes` and render a single `<ChatProgressBar>` in their place. Replace:

```tsx
                <div className={styles.bubble}>
                  {message.nodes.map((node, nodeIdx) => (
                    <NodeRenderer
                      key={`${message.id}-${nodeIdx}`}
                      node={node}
                      callbacks={{
```

with this complete block (replacing through the closing `</div>` of `.bubble`):

```tsx
<div className={styles.bubble}>
  {(() => {
    const toolNodes = message.nodes.filter(
      (n) => n.type === 'tool_progress',
    ) as Extract<ChatNode, { type: 'tool_progress' }>[];
    const otherNodes = message.nodes.filter((n) => n.type !== 'tool_progress');
    return (
      <>
        {toolNodes.length > 0 && (
          <ChatProgressBar
            mode='determinate'
            done={toolNodes.filter((n) => n.status === 'done').length}
            total={toolNodes.length}
            latestLabel={getToolLabelForName(
              toolNodes.filter((n) => n.status === 'running').at(-1)
                ?.tool_name ??
                toolNodes.at(-1)?.tool_name ??
                '',
            )}
          />
        )}
        {otherNodes.map((node, nodeIdx) => (
          <NodeRenderer
            key={`${message.id}-${nodeIdx}`}
            node={node}
            callbacks={{
              onQuickReply,
              onFormSubmit,
              onConfirmFlight: (label) =>
                onQuickReply(`I've selected the ${label} flight`),
              onConfirmHotel: (label) => onQuickReply(`I've selected ${label}`),
              onConfirmCarRental: (label) =>
                onQuickReply(`I've selected the ${label} rental`),
              onConfirmExperience: (label) =>
                onQuickReply(`I've selected ${label}`),
            }}
          />
        ))}
      </>
    );
  })()}
</div>
```

Then add the helper function near the top of the file (after the `NODE_HEIGHT_ESTIMATES` constant):

```tsx
const TOOL_LABELS: Record<string, string> = {
  search_flights: 'Searching flights',
  search_hotels: 'Searching hotels',
  search_car_rentals: 'Searching car rentals',
  search_experiences: 'Finding experiences',
  calculate_remaining_budget: 'Calculating budget',
  get_destination_info: 'Looking up destination',
  format_response: 'Assembling response',
};

function getToolLabelForName(toolName: string): string {
  if (!toolName) return 'Working';
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ');
}
```

- [ ] **Step 3.10: Run the invariants test to verify it passes**

Run: `pnpm test ChatBox.invariants.test.tsx`
Expected: all invariants 1 through 6 pass.

- [ ] **Step 3.11: Delete the obsolete ToolProgressIndicator files**

```bash
rm web-client/src/components/ChatBox/nodes/ToolProgressIndicator.tsx \
   web-client/src/components/ChatBox/nodes/ToolProgressIndicator.module.scss
```

- [ ] **Step 3.12: Run the full verification chain**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
```

Expected: all green. If tsc complains about an unused import or `never` exhaustive check in NodeRenderer, fix inline.

- [ ] **Step 3.13: Commit B3**

```bash
git add web-client/src/components/ChatBox/widgets/ChatProgressBar.tsx \
        web-client/src/components/ChatBox/widgets/ChatProgressBar.module.scss \
        web-client/src/components/ChatBox/widgets/ChatProgressBar.test.tsx \
        web-client/src/components/ChatBox/VirtualizedChat.tsx \
        web-client/src/components/ChatBox/NodeRenderer.tsx \
        web-client/src/components/ChatBox/ChatBox.invariants.test.tsx \
        web-client/src/components/ChatBox/nodes/ToolProgressIndicator.tsx \
        web-client/src/components/ChatBox/nodes/ToolProgressIndicator.module.scss
git commit -m "$(cat <<'EOF'
fix(B3): consolidate tool progress into one bar

Replace the per-tool ToolProgressIndicator chips with a single
ChatProgressBar widget that collapses adjacent tool_progress nodes
into one determinate progress bar plus a single status label.
Adds invariant 6 to ChatBox.invariants.test.tsx so future fixes
cannot reintroduce the chip stack. Removes the old chip component
and stylesheet entirely.
EOF
)"
```

---

## Task 4: B4 — Pending indicator before first stream chunk

**Files:**

- Modify: `web-client/src/components/ChatBox/ChatBox.tsx`
- Modify: `web-client/src/components/ChatBox/VirtualizedChat.tsx`
- Modify: `web-client/src/components/ChatBox/ChatBox.invariants.test.tsx`

- [ ] **Step 4.1: Write the failing invariants test**

Open `web-client/src/components/ChatBox/ChatBox.invariants.test.tsx`. Append after the invariant 6 block:

```tsx
describe('invariant 7: pending indicator renders synchronously after send', () => {
  it('shows an indeterminate progress bar with "Thinking" while isSending=true and no nodes have arrived yet', () => {
    const userMsg = makeUserMessage('m1', 'Plan a Beijing trip');

    render(
      <VirtualizedChat
        messages={[userMsg]}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending
        onQuickReply={noop}
      />,
    );

    // Indeterminate bar must be present.
    const bar = screen.getByRole('progressbar', { name: /thinking/i });
    expect(bar).toBeInTheDocument();
    // It must NOT have a determinate aria-valuenow set.
    expect(bar).not.toHaveAttribute('aria-valuenow');
  });

  it('removes the pending indicator once the first streaming node arrives', () => {
    const userMsg = makeUserMessage('m1', 'Plan a Beijing trip');

    const { rerender } = render(
      <VirtualizedChat
        messages={[userMsg]}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending
        onQuickReply={noop}
      />,
    );
    expect(
      screen.queryByRole('progressbar', { name: /thinking/i }),
    ).toBeInTheDocument();

    // First SSE event lands: streamingText starts populating.
    rerender(
      <VirtualizedChat
        messages={[userMsg]}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText='Looking at your options'
        isSending
        onQuickReply={noop}
      />,
    );

    expect(
      screen.queryByRole('progressbar', { name: /thinking/i }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2: Run the failing test**

Run: `pnpm test ChatBox.invariants.test.tsx`
Expected: invariant 7 FAILS — no "Thinking" progressbar yet.

- [ ] **Step 4.3: Add pending indicator render in VirtualizedChat**

Edit `web-client/src/components/ChatBox/VirtualizedChat.tsx`. Inside the main container, AFTER the empty-state block and BEFORE the virtualized list block, add:

```tsx
{
  isSending &&
    streamingNodes.length === 0 &&
    toolProgress.length === 0 &&
    streamingText === '' && (
      <div className={styles.pendingIndicator}>
        <ChatProgressBar mode='indeterminate' label='Thinking' />
      </div>
    );
}
```

Then add the `.pendingIndicator` style to `web-client/src/components/ChatBox/VirtualizedChat.module.scss`. Open the file and append:

```scss
.pendingIndicator {
  padding: 12px 24px;
  display: flex;
  justify-content: flex-start;
}
```

- [ ] **Step 4.4: Run the test to verify it passes**

Run: `pnpm test ChatBox.invariants.test.tsx`
Expected: all invariants 1 through 7 pass.

- [ ] **Step 4.5: Run the full verification chain**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 4.6: Commit B4**

```bash
git add web-client/src/components/ChatBox/VirtualizedChat.tsx \
        web-client/src/components/ChatBox/VirtualizedChat.module.scss \
        web-client/src/components/ChatBox/ChatBox.invariants.test.tsx
git commit -m "$(cat <<'EOF'
fix(B4): show pending indicator before first stream chunk

When isSending is true but no streaming nodes, tool progress, or
text have arrived yet, render an indeterminate ChatProgressBar
with the label "Thinking" so the user can see their request was
received. Disappears as soon as the first SSE event arrives. Adds
invariant 7 to lock the behavior.
EOF
)"
```

---

## Task 5: B6 — Replace huge book buttons with inline assistant prompt tile

**Files:**

- Create: `web-client/src/components/ChatBox/nodes/BookingPrompt.tsx`
- Create: `web-client/src/components/ChatBox/nodes/BookingPrompt.module.scss`
- Create: `web-client/src/components/ChatBox/nodes/BookingPrompt.test.tsx`
- Modify: `packages/shared-types/src/nodes.ts`
- Modify: `web-client/src/components/ChatBox/NodeRenderer.tsx`
- Modify: `web-client/src/components/ChatBox/ChatBox.tsx`
- Modify: `web-client/src/components/ChatBox/ChatBox.module.scss`
- Modify: `web-client/src/components/ChatBox/ChatBox.invariants.test.tsx`

### Subtask 5A: Add booking_prompt node type

- [ ] **Step 5.1: Add booking_prompt to ChatNode union**

Edit `packages/shared-types/src/nodes.ts`. Inside the `ChatNode` union (line 105 to 132), add a new branch BEFORE the closing `;`:

```typescript
  | {
      type: 'booking_prompt';
      experiences_empty: boolean;
      car_rentals_empty: boolean;
    }
```

So the final union has 13 entries. Save the file.

- [ ] **Step 5.2: Build the shared-types package**

Run from the repo root:

```bash
pnpm --filter @voyager/shared-types build
```

Expected: build succeeds.

### Subtask 5B: BookingPrompt component

- [ ] **Step 5.3: Write the failing tests**

Create `web-client/src/components/ChatBox/nodes/BookingPrompt.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BookingPrompt } from './BookingPrompt';

afterEach(cleanup);

describe('BookingPrompt', () => {
  it('renders Book now and Change something chips when both empty flags are false', () => {
    render(
      <BookingPrompt
        experiencesEmpty={false}
        carRentalsEmpty={false}
        onBookNow={() => {}}
        onQuickReply={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Book now' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change something' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add experiences' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add car rental' }),
    ).not.toBeInTheDocument();
  });

  it('renders Add experiences chip only when experiencesEmpty is true', () => {
    render(
      <BookingPrompt
        experiencesEmpty
        carRentalsEmpty={false}
        onBookNow={() => {}}
        onQuickReply={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Add experiences' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add car rental' }),
    ).not.toBeInTheDocument();
  });

  it('renders all four chips when both empty flags are true', () => {
    render(
      <BookingPrompt
        experiencesEmpty
        carRentalsEmpty
        onBookNow={() => {}}
        onQuickReply={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Book now' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add experiences' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add car rental' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change something' }),
    ).toBeInTheDocument();
  });

  it('calls onBookNow when Book now is clicked', () => {
    const onBookNow = vi.fn();
    render(
      <BookingPrompt
        experiencesEmpty={false}
        carRentalsEmpty={false}
        onBookNow={onBookNow}
        onQuickReply={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Book now' }));
    expect(onBookNow).toHaveBeenCalledTimes(1);
  });

  it('calls onQuickReply with the correct prompt for Change something', () => {
    const onQuickReply = vi.fn();
    render(
      <BookingPrompt
        experiencesEmpty={false}
        carRentalsEmpty={false}
        onBookNow={() => {}}
        onQuickReply={onQuickReply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Change something' }));
    expect(onQuickReply).toHaveBeenCalledWith(
      "I'd like to make some changes to the itinerary. What would you suggest adjusting?",
    );
  });

  it('calls onQuickReply with the experiences prompt for Add experiences', () => {
    const onQuickReply = vi.fn();
    render(
      <BookingPrompt
        experiencesEmpty
        carRentalsEmpty={false}
        onBookNow={() => {}}
        onQuickReply={onQuickReply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add experiences' }));
    expect(onQuickReply).toHaveBeenCalledWith(
      'Can you suggest some experiences for this trip?',
    );
  });

  it('calls onQuickReply with the car rental prompt for Add car rental', () => {
    const onQuickReply = vi.fn();
    render(
      <BookingPrompt
        experiencesEmpty={false}
        carRentalsEmpty
        onBookNow={() => {}}
        onQuickReply={onQuickReply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add car rental' }));
    expect(onQuickReply).toHaveBeenCalledWith(
      'Can you find a car rental for this trip?',
    );
  });
});
```

- [ ] **Step 5.4: Run the failing tests**

Run from `web-client/`:

```bash
pnpm test BookingPrompt.test.tsx
```

Expected: FAIL — `BookingPrompt` does not exist.

- [ ] **Step 5.5: Implement BookingPrompt.tsx**

Create `web-client/src/components/ChatBox/nodes/BookingPrompt.tsx`:

```tsx
import { QuickReplyChips } from '../widgets/QuickReplyChips';
import styles from './BookingPrompt.module.scss';

interface BookingPromptProps {
  experiencesEmpty: boolean;
  carRentalsEmpty: boolean;
  onBookNow: () => void;
  onQuickReply: (text: string) => void;
}

const CHIP_BOOK_NOW = 'Book now';
const CHIP_ADD_EXPERIENCES = 'Add experiences';
const CHIP_ADD_CAR_RENTAL = 'Add car rental';
const CHIP_CHANGE_SOMETHING = 'Change something';

const ADD_EXPERIENCES_PROMPT =
  'Can you suggest some experiences for this trip?';
const ADD_CAR_RENTAL_PROMPT = 'Can you find a car rental for this trip?';
const CHANGE_SOMETHING_PROMPT =
  "I'd like to make some changes to the itinerary. What would you suggest adjusting?";

export function BookingPrompt({
  experiencesEmpty,
  carRentalsEmpty,
  onBookNow,
  onQuickReply,
}: BookingPromptProps) {
  const chips: string[] = [CHIP_BOOK_NOW];
  if (experiencesEmpty) chips.push(CHIP_ADD_EXPERIENCES);
  if (carRentalsEmpty) chips.push(CHIP_ADD_CAR_RENTAL);
  chips.push(CHIP_CHANGE_SOMETHING);

  const handleSelect = (chip: string) => {
    if (chip === CHIP_BOOK_NOW) {
      onBookNow();
      return;
    }
    if (chip === CHIP_ADD_EXPERIENCES) {
      onQuickReply(ADD_EXPERIENCES_PROMPT);
      return;
    }
    if (chip === CHIP_ADD_CAR_RENTAL) {
      onQuickReply(ADD_CAR_RENTAL_PROMPT);
      return;
    }
    if (chip === CHIP_CHANGE_SOMETHING) {
      onQuickReply(CHANGE_SOMETHING_PROMPT);
      return;
    }
  };

  return (
    <div className={styles.wrapper}>
      <p className={styles.body}>
        Ready to book this trip, or want to keep refining?
      </p>
      <QuickReplyChips chips={chips} onSelect={handleSelect} />
    </div>
  );
}
```

- [ ] **Step 5.6: Implement BookingPrompt.module.scss**

Create `web-client/src/components/ChatBox/nodes/BookingPrompt.module.scss`:

```scss
.wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: var(--surface-alt);
  border: 1px solid var(--border-light);
  margin-top: 4px;
}

.body {
  margin: 0;
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.5;
  color: var(--foreground);
}
```

- [ ] **Step 5.7: Run BookingPrompt tests to verify they pass**

Run: `pnpm test BookingPrompt.test.tsx`
Expected: all 7 tests pass.

### Subtask 5C: Wire BookingPrompt into NodeRenderer and ChatBox

- [ ] **Step 5.8: Add booking_prompt case to NodeRenderer**

Edit `web-client/src/components/ChatBox/NodeRenderer.tsx`. Add the import:

```tsx
import { BookingPrompt } from './nodes/BookingPrompt';
```

Then add a case to the switch statement, BEFORE the `default:` block:

```tsx
    case 'booking_prompt':
      return (
        <BookingPrompt
          experiencesEmpty={node.experiences_empty}
          carRentalsEmpty={node.car_rentals_empty}
          onBookNow={cb.onBookNow ?? (() => {})}
          onQuickReply={cb.onQuickReply ?? (() => {})}
        />
      );
```

Add `onBookNow?: () => void;` to the `NodeRendererCallbacks` interface at the top of the file:

```tsx
export interface NodeRendererCallbacks {
  onConfirmFlight?: (label: string) => void;
  onConfirmHotel?: (label: string) => void;
  onConfirmCarRental?: (label: string) => void;
  onConfirmExperience?: (label: string) => void;
  onQuickReply?: (text: string) => void;
  onBookNow?: () => void;
  onFormSubmit?: (
    structuredData: Record<string, string>,
    displayMessage: string,
  ) => void;
  disabled?: boolean;
  confirmedFlightId?: string | null;
  confirmedHotelId?: string | null;
  confirmedCarRentalId?: string | null;
  confirmedExperienceId?: string | null;
}
```

- [ ] **Step 5.9: Wire onBookNow through VirtualizedChat callbacks**

Edit `web-client/src/components/ChatBox/VirtualizedChat.tsx`. Add `onBookNow?: () => void;` to `VirtualizedChatProps`. Pass it through the callbacks object passed to `NodeRenderer`:

```tsx
                            callbacks={{
                              onQuickReply,
                              onFormSubmit,
                              onBookNow,
                              onConfirmFlight: (label) =>
                                onQuickReply(`I've selected the ${label} flight`),
                              onConfirmHotel: (label) =>
                                onQuickReply(`I've selected ${label}`),
                              onConfirmCarRental: (label) =>
                                onQuickReply(`I've selected the ${label} rental`),
                              onConfirmExperience: (label) =>
                                onQuickReply(`I've selected ${label}`),
                            }}
```

Add `onBookNow` to the destructured props at the top of the function signature.

- [ ] **Step 5.10: Update ChatBox.tsx to inject the booking_prompt virtual node and remove the old buttons**

Edit `web-client/src/components/ChatBox/ChatBox.tsx`. Add `hasHotels?: boolean;` and `experiencesEmpty?: boolean;` and `carRentalsEmpty?: boolean;` to `ChatBoxProps`:

```tsx
interface ChatBoxProps {
  tripId: string;
  hasFlights?: boolean;
  hasHotels?: boolean;
  experiencesEmpty?: boolean;
  carRentalsEmpty?: boolean;
  tripStatus?: string;
  onBookTrip?: () => void;
}
```

Destructure them in the function signature:

```tsx
export function ChatBox({
  tripId,
  hasFlights,
  hasHotels,
  experiencesEmpty,
  carRentalsEmpty,
  tripStatus,
  onBookTrip,
}: ChatBoxProps) {
```

Update `showBookingActions` to require hotels too:

```tsx
const showBookingActions =
  hasFlights &&
  hasHotels &&
  tripStatus === 'planning' &&
  !isSending &&
  !hasActiveTileSelection;
```

Compute the augmented messages list. After the existing `allMessages` array build, add:

```tsx
// B6: when booking criteria are met, append a client-only booking_prompt
// virtual node so the inline tile renders as the last assistant message.
const messagesWithBookingPrompt = useMemo<ChatMessage[]>(() => {
  if (!showBookingActions) return allMessages;
  const promptNode = {
    type: 'booking_prompt' as const,
    experiences_empty: experiencesEmpty ?? true,
    car_rentals_empty: carRentalsEmpty ?? true,
  };
  const promptMessage: ChatMessage = {
    id: '__booking_prompt__',
    role: 'assistant',
    nodes: [promptNode],
    sequence: allMessages.length + 1,
    created_at: new Date().toISOString(),
  };
  return [...allMessages, promptMessage];
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [allMessages, showBookingActions, experiencesEmpty, carRentalsEmpty]);
```

Add the `useMemo` import at the top:

```tsx
import { type FormEvent, useCallback, useMemo, useRef, useState } from 'react';
```

Pass `messagesWithBookingPrompt` and `onBookNow` to `<VirtualizedChat>`:

```tsx
<VirtualizedChat
  messages={messagesWithBookingPrompt}
  streamingNodes={streamingNodes}
  toolProgress={toolProgress}
  streamingText={streamingText}
  isSending={isSending}
  onQuickReply={handleSend}
  onFormSubmit={handleFormSubmit}
  onBookNow={handleBookTrip}
/>
```

Delete the old `{showBookingActions && (...)}` block (lines 194 to 215 in the current file). Verify the `bookingActions`, `bookButton`, `tryAgainButton` classNames are no longer referenced.

- [ ] **Step 5.11: Delete the old SCSS rules for the buttons**

Edit `web-client/src/components/ChatBox/ChatBox.module.scss`. Search for `.bookingActions`, `.bookButton`, `.tryAgainButton` and delete those rule blocks. Use:

```bash
pnpm exec rg -n "bookingActions|bookButton|tryAgainButton" web-client/src/components/ChatBox/ChatBox.module.scss
```

to locate them. Remove the matched blocks.

- [ ] **Step 5.12: Pass `hasHotels`, `experiencesEmpty`, `carRentalsEmpty` from the trip page to ChatBox**

Edit `web-client/src/app/(protected)/trips/[id]/page.tsx`. Find the `<ChatBox ...>` invocation (around line 199) and update the props:

```tsx
<ChatBox
  tripId={trip.id}
  hasFlights={hasFlights}
  hasHotels={trip.hotels.length > 0}
  experiencesEmpty={trip.experiences.length === 0}
  carRentalsEmpty={trip.car_rentals.length === 0}
  tripStatus={trip.status}
  onBookTrip={() => setShowConfirmation(true)}
/>
```

### Subtask 5D: Invariant 8

- [ ] **Step 5.13: Write the failing invariant**

Open `web-client/src/components/ChatBox/ChatBox.invariants.test.tsx`. Append after invariant 7:

```tsx
describe('invariant 8: BookingPrompt tile renders inline as a chat node', () => {
  it('renders exactly one BookingPrompt when an assistant message contains a booking_prompt node', () => {
    const promptMessage = makeAssistantMessage('msg-1', [
      {
        type: 'booking_prompt',
        experiences_empty: true,
        car_rentals_empty: true,
      },
    ]);

    render(
      <VirtualizedChat
        messages={[promptMessage]}
        streamingNodes={[]}
        toolProgress={[]}
        streamingText=''
        isSending={false}
        onQuickReply={noop}
      />,
    );

    // Body copy is rendered exactly once.
    const matches = screen.getAllByText(/Ready to book this trip/);
    expect(matches).toHaveLength(1);
    // Book now chip is present.
    expect(
      screen.getByRole('button', { name: 'Book now' }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 5.14: Run the failing test**

Run: `pnpm test ChatBox.invariants.test.tsx`
Expected: invariant 8 PASS already because the wiring through NodeRenderer is already in place. If FAIL, fix the wiring chain (NodeRenderer case, VirtualizedChat callbacks).

- [ ] **Step 5.15: Run the full verification chain**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
```

Expected: all green. If TypeScript complains about exhaustive `never` checks for the new node type, the `case 'booking_prompt':` in NodeRenderer fixes it.

- [ ] **Step 5.16: Commit B6**

```bash
git add packages/shared-types/src/nodes.ts \
        web-client/src/components/ChatBox/nodes/BookingPrompt.tsx \
        web-client/src/components/ChatBox/nodes/BookingPrompt.module.scss \
        web-client/src/components/ChatBox/nodes/BookingPrompt.test.tsx \
        web-client/src/components/ChatBox/NodeRenderer.tsx \
        web-client/src/components/ChatBox/VirtualizedChat.tsx \
        web-client/src/components/ChatBox/ChatBox.tsx \
        web-client/src/components/ChatBox/ChatBox.module.scss \
        web-client/src/components/ChatBox/ChatBox.invariants.test.tsx \
        web-client/src/app/\(protected\)/trips/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
fix(B6): replace huge book buttons with inline assistant prompt tile

Replace the sticky two-button bar (Book This Trip / Try Again) with
an inline BookingPrompt tile rendered as the last assistant message
in the chat stream. Adds a client-only booking_prompt virtual node
type that NodeRenderer maps to the new BookingPrompt component. The
tile shows conditional chips (Book now, Add experiences, Add car
rental, Change something) based on what is missing from the trip.
Adds invariant 8 to lock the inline render path.
EOF
)"
```

---

## Task 6: B5 — Playwright snapshot for chat-itinerary spacing

**Files:**

- Create: `e2e/trip-page-spacing.spec.ts`
- Modify: `web-client/src/app/(protected)/trips/[id]/tripDetail.module.scss`

- [ ] **Step 6.1: Identify the trip detail SCSS file**

```bash
ls web-client/src/app/\(protected\)/trips/\[id\]/
```

Expected: `tripDetail.module.scss` is present.

- [ ] **Step 6.2: Add margin between the chat section and the itinerary section**

Open `web-client/src/app/(protected)/trips/[id]/tripDetail.module.scss`. Find the `.chatSection` and `.itinerary` rules. Add (or extend) `.chatSection` to have a bottom margin:

```scss
.chatSection {
  margin-bottom: 48px;
}
```

If there is already a margin-bottom value, set it to at least `48px`. If `.itinerary` exists, ensure it has `margin-top: 48px` as a belt-and-braces fallback so the gap survives any reordering.

- [ ] **Step 6.3: Inspect existing E2E spacing tests for the canonical login + create-trip pattern**

Before writing the spec, look at how `e2e/chat-booking-flow.spec.ts` and `e2e/trip-management.spec.ts` set up an authenticated session and a trip. They use `register` / `login` from `e2e/helpers/auth.ts` and `createTrip` / `loadTrip` from `e2e/helpers/trip.ts`. Match that pattern exactly. Read both spec files and reuse the same beforeEach setup verbatim.

```bash
pnpm exec rg -n "import.*helpers" e2e/chat-booking-flow.spec.ts e2e/trip-management.spec.ts
```

- [ ] **Step 6.4: Write the Playwright snapshot test**

Create `e2e/trip-page-spacing.spec.ts`. Use the same imports and setup pattern as `e2e/chat-booking-flow.spec.ts` (the closest analog because it also lands on the trip detail page). The skeleton:

```typescript
import { expect, test } from '@playwright/test';

import { register } from './helpers/auth';
import { createTrip, loadTrip } from './helpers/trip';

test.describe('Trip detail page spacing (B5)', () => {
  test('chat box and Flights heading have visible vertical gap', async ({
    page,
  }) => {
    // Register a fresh user and create a trip with at least one flight.
    // Match the pattern from chat-booking-flow.spec.ts exactly: any
    // deviation here is a sign you should re-read that spec, not improvise.
    const email = `b5-${Date.now()}@example.com`;
    await register(page, { email, password: 'TestPass123!' });
    await createTrip(page);

    // Wait for the chat section and the Flights heading to both exist.
    // The Flights section only appears once a flight has been added to
    // the trip; if your createTrip helper does not seed a flight, send
    // a chat message that triggers the flight tile path and confirm a
    // flight before measuring. See chat-booking-flow.spec.ts for the
    // exact sequence.
    await page.waitForSelector('text=/Chat with/i');
    await page.waitForSelector('h2:has-text("Flights")');

    const chatHeading = page.locator('text=/Chat with/i').first();
    const flightsHeading = page.locator('h2:has-text("Flights")').first();

    // We measure from the bottom of the chat container to the top of
    // the Flights heading. Use the chat container's bounding box, not
    // the heading text, since the chat box has its own height below
    // its heading.
    const chatBox = await chatHeading.evaluate((el) => {
      const container = el.closest('section, div');
      const rect = (container ?? el).getBoundingClientRect();
      return { y: rect.y, height: rect.height };
    });
    const flightsBox = await flightsHeading.boundingBox();
    if (!flightsBox) {
      throw new Error('Could not measure Flights heading bounding box');
    }

    // Computed-style assertion: the visual gap between the bottom of
    // the chat section and the top of the Flights heading must be at
    // least 32px. This is the regression guard requested for B5.
    const gap = flightsBox.y - (chatBox.y + chatBox.height);
    expect(gap).toBeGreaterThanOrEqual(32);

    // Visual snapshot of the boundary region for additional regression
    // protection. Clipped to the boundary so dynamic content elsewhere
    // on the page cannot flake the snapshot.
    await expect(page).toHaveScreenshot('trip-page-chat-itinerary-gap.png', {
      clip: {
        x: 0,
        y: chatBox.y + chatBox.height - 20,
        width: page.viewportSize()?.width ?? 1280,
        height: gap + 80,
      },
      maxDiffPixelRatio: 0.02,
    });
  });
});
```

If the existing `createTrip` helper does not result in a trip that has a flight selected by the time you reach this test, follow the chat-booking-flow.spec.ts pattern to send a planning message, wait for the flight tile, and confirm a flight before measuring. Do NOT skip the assertion just because the helper is sparse; extend the test until the page is in the state the spec describes.

- [ ] **Step 6.5: Run the Playwright test to create the snapshot baseline**

Run from the repo root:

```bash
pnpm test:e2e --update-snapshots e2e/trip-page-spacing.spec.ts
```

Expected: PASS, baseline snapshot created at `e2e/__snapshots__/trip-page-spacing.spec.ts-snapshots/trip-page-chat-itinerary-gap-*.png`.

- [ ] **Step 6.6: Run again without --update-snapshots to confirm the baseline is stable**

```bash
pnpm test:e2e e2e/trip-page-spacing.spec.ts
```

Expected: PASS, no diff.

- [ ] **Step 6.7: Run the full verification chain**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
```

Expected: all green. The Playwright test is part of `pnpm test:e2e`, not `pnpm test`, so `pnpm test` does not run it; that is intentional per the project's pre-push fast-lane convention.

- [ ] **Step 6.8: Commit B5**

```bash
git add web-client/src/app/\(protected\)/trips/\[id\]/tripDetail.module.scss \
        e2e/trip-page-spacing.spec.ts \
        e2e/__snapshots__/
git commit -m "$(cat <<'EOF'
fix(B5): add gap between chat box and itinerary sections

Add 48px margin-bottom to the trip detail chat section so the
Flights heading no longer sits flush against the chat composer.
Adds a Playwright snapshot test that asserts a minimum 32px gap
plus a visual snapshot baseline for regression protection.
EOF
)"
```

---

## Task 7: Update docs/BUGS.md and docs/audits triage

**Files:**

- Modify: `docs/BUGS.md`
- Create: `docs/audits/2026-04-07-triage.md` (if not present)

- [ ] **Step 7.1: Append B1 through B6 entries to docs/BUGS.md**

Open `docs/BUGS.md`. Append (or insert in the appropriate "Resolved" section per the file's existing structure):

```markdown
### B1: Trip detail Budget tile and Cost Breakdown render `$NaN`

severity: P1 effort: S — fixed 2026-04-07
Root cause: pg returned NUMERIC columns as strings, and the trip detail
page reduced over `c.total_price` without a `?? 0` defensive default.
Fix: registered a global pg.types parser for NUMERIC so currency
columns come back as numbers, plus a defensive `?? 0` and a
Number.isFinite guard on the frontend. Test in
`server/src/db/pool/pool.test.ts` and
`web-client/src/app/(protected)/trips/[id]/page.test.tsx`.

### B2: Car rental tool throws and the agent narrates "having trouble accessing"

severity: P1 effort: M — fixed 2026-04-07
Root cause: `searchCarRentals` did not catch SerpApi errors, so any
upstream failure threw to the executor and the agent improvised a
fallback narration. Fix: wrap the SerpApi call in try/catch and
return `{ rentals: [], error }` instead. Updated tool description to
make the no-results path explicit.

### B3: ToolProgressIndicator chips have no gap and look broken

severity: P2 effort: M — fixed 2026-04-07
Root cause: per-tool chip rendering with no margin between chips and a
duplicate "Done" label. Fix: replaced the chip stack with a single
ChatProgressBar widget that collapses adjacent tool_progress nodes
into one determinate progress bar. Locked with invariant 6.

### B4: Chat appears dead between submit and first stream chunk

severity: P2 effort: S — fixed 2026-04-07
Root cause: no UI feedback during the gap between the user sending a
message and the first SSE event arriving. Fix: render an indeterminate
ChatProgressBar with the label "Thinking" while isSending is true and
no streaming nodes have arrived yet. Locked with invariant 7.

### B5: No gap between chat box and Flights section

severity: P3 effort: S — fixed 2026-04-07
Root cause: missing margin-bottom on `.chatSection` in the trip detail
SCSS module. Fix: 48px bottom margin plus a Playwright snapshot test
that asserts a minimum 32px gap.

### B6: "Book This Trip" / "Try Again" buttons are huge and intrusive

severity: P2 effort: M — fixed 2026-04-07
Root cause: the booking actions UI was a sticky two-button bar with
oversized buttons and no gutter from the input. Fix: replaced with an
inline BookingPrompt tile rendered as the last assistant message in
the chat stream. Conditional chips show only what is missing from the
trip. Locked with invariant 8.
```

- [ ] **Step 7.2: Mirror P1 entries to today's triage doc**

If `docs/audits/2026-04-07-triage.md` does not exist, create it. If it exists, append. Add only B1 and B2 (the two P1 items per the global "P0/P1 mirrored to triage" rule):

```markdown
# 2026-04-07 Triage

## P1

### B1: Trip detail Budget tile renders $NaN

Source: user-reported, 2026-04-07. Visible in production. Affects
core trust signal (every trip with car rentals on a recent build).
See docs/BUGS.md B1 for fix details.

### B2: Car rental tool throws on SerpApi errors

Source: user-reported, 2026-04-07. Affects every trip in regions
where SerpApi google_car_rental engine returns non-200. See
docs/BUGS.md B2 for fix details.
```

- [ ] **Step 7.3: Commit the docs**

```bash
git add docs/BUGS.md docs/audits/2026-04-07-triage.md
git commit -m "$(cat <<'EOF'
docs(BUGS): tag B1 through B6 with severity and effort

Append the six bug-fix-batch-2026-04-07 entries to docs/BUGS.md and
mirror the P1 items (B1, B2) to docs/audits/2026-04-07-triage.md per
the global "triage by severity" rule.
EOF
)"
```

---

## Task 8: Final verification and push

- [ ] **Step 8.1: Run the full verification chain one final time**

From the repo root:

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 8.2: Run the E2E suite if Playwright is set up locally**

```bash
pnpm test:e2e
```

Expected: all green including the new spacing snapshot.

- [ ] **Step 8.3: Verify the commit log is one commit per bug ID**

```bash
git log --oneline -10
```

Expected (newest at top):

```
docs(BUGS): tag B1 through B6 with severity and effort
fix(B5): add gap between chat box and itinerary sections
fix(B6): replace huge book buttons with inline assistant prompt tile
fix(B4): show pending indicator before first stream chunk
fix(B3): consolidate tool progress into one bar
fix(B2): make car rental tool fail soft
fix(B1): coerce trip detail numeric columns and guard NaN
```

- [ ] **Step 8.4: Push to main and monitor deploy**

```bash
git push origin main
```

Per the project's "Deploy Monitoring" rule, poll all four surfaces until green or 5 minutes elapses:

1. `gh run list --repo nullvoidundefined/voyager --limit 5`
2. `railway deployment list | head -5`
3. `npx vercel ls --scope <scope>`
4. Manual GET on `/health` and the frontend landing page; both must return 200.

If any surface fails, diagnose before claiming done.

---

## Out of scope reminders

- Do not refactor unrelated code in any of these commits.
- Do not add features beyond what the spec describes.
- Do not change the agent system prompt beyond the one-line `search_car_rentals` description update in B2.
- Any new bug discovered during implementation goes to `docs/BUGS.md` for a future batch, not this one.
- No `--no-verify` git commits without explicit per-commit user authorization.
- No em dashes (U+2014) anywhere in code, comments, prompts, or commit messages.
