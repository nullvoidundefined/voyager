# Chat Discovery (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Voyager concierge a discovery gear: it helps a user who has not chosen a destination, surfaces candidate places as in-chat cards, and pivots the same conversation into the existing planning flow.

**Architecture:** Rides the finished multi-modal-journeys architecture on `origin/main` (`bfd055a`). A new `discover_destinations` tool ranks the curated catalog and returns destinations as the existing generic `offer_tiles` node under a new non-bookable `offer_kind: 'destination'`. A new `DISCOVER` flow phase (upstream of `COLLECT_DETAILS`, gated on an empty destination) routes to a new `discover` core sub-agent whose prompt drives grazing. The pivot is emergent: the agent calls `update_trip` on commit and `getFlowPosition` advances on its own.

**Tech Stack:** TypeScript, Express 5, Zod (tool schemas), Vitest, Next.js 15 + React (client), pnpm workspaces. Packages: `voyager-server`, `voyager-web`, `@repo/types`.

## Global Constraints

- Portfolio demo, chat-first: discovery serves and funnels into the chat; it is not a standalone browse UI. Keep the demo framing.
- Grounding blend: destination-finding is curated (catalog only, no network); in-place curiosity uses the existing `search_experiences` tool. SerpApi is never called in discovery.
- Never fabricate: present only curated fields. Budgets are curated estimates, labeled "from ~$X/day (est.)". Never invent live prices (matches the core prompt's no-unbacked-price rule).
- No U+2014 em dash anywhere (code, comments, commit messages, prompt strings). Use commas, periods, colons, or parentheses.
- No `any`; type values or use `unknown` and narrow. Every new source file starts with a `/** */` header comment.
- Match surrounding code: 2-space indent, single quotes, trailing commas; alphabetized declaration groups and object keys where order is free.
- Tests live in the `src/__tests__/` mirror, never co-located. Assert behavior, not mock-call counts. Use the real catalog as the fixture. Every user-input handler gets one negative-input test.
- One commit per task, conventional subject (`type(scope): summary`), ending with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

**Targeted test command:** `pnpm --filter voyager-server test <path>` (server) or `pnpm --filter voyager-web test <path>` (web). Both run `vitest run`, which accepts a path filter.

---

## File Structure

Server (`apps/server/src/`):

- `data/loadDestinations.ts` (new): loads and caches the curated catalog JSON, exports the `Destination` type. One responsibility, catalog access.
- `tools/discoverDestinationsTool.ts` (new): pure ranking logic, criteria in, ranked `Offer[]` out.
- `tools/registry/discoverDestinations.ts` (new): the tool's Zod schema plus `ToolModule` (name, description).
- `tools/schemas.ts`, `tools/registry/toolRegistry.ts`, `tools/executor.ts` (modify): register and dispatch the tool.
- `services/agent/nodeBuilder.ts` (modify): map the tool result to a `destination` `offer_tiles` node.
- `prompts/bookingSteps.ts` (modify): `DISCOVER` phase in `FlowPosition` and the `getFlowPosition` guard.
- `services/agent/subAgentTypes.ts`, `isCoreSubAgent.ts`, `coreSubAgentTools.ts`, `selectSubAgent.ts` (modify): the `discover` core sub-agent and its tool partition.
- `prompts/systemPrompt.ts` (modify): the `DISCOVER` prompt addendum.

Shared types (`packages/types/src/`):

- `segments.ts` (modify): widen `OfferKind` to include `'destination'`.

Web (`apps/client/web/src/`):

- `components/ChatBox/nodes/offerCards/DestinationOfferCard.tsx` (new): the destination card.
- `components/ChatBox/nodes/offerCardRegistry.tsx` (modify): register the `destination` card entry.

---

## Task 1: Server destination catalog loader

**Files:**

- Create: `apps/server/src/data/loadDestinations.ts`
- Test: `apps/server/src/__tests__/data/loadDestinations.test.ts`

**Interfaces:**

- Consumes: the existing asset `apps/server/src/data/destinations.json` (already copied to `dist/` by the boot asset step in `app.ts`).
- Produces: `interface Destination { ... }`; `function loadDestinations(): Destination[]`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';

import { loadDestinations } from 'app/data/loadDestinations.js';

describe('loadDestinations', () => {
  it('loads the curated catalog as a non-empty array', () => {
    const destinations = loadDestinations();
    expect(destinations.length).toBeGreaterThan(20);
  });

  it('exposes the fields discovery ranks on', () => {
    const tokyo = loadDestinations().find((d) => d.slug === 'tokyo');
    expect(tokyo).toBeDefined();
    expect(tokyo?.country).toBe('Japan');
    expect(Array.isArray(tokyo?.categories)).toBe(true);
    expect(typeof tokyo?.price_level).toBe('number');
    expect(typeof tokyo?.estimated_daily_budget.budget).toBe('number');
    expect(tokyo?.weather.length).toBeGreaterThan(0);
  });

  it('returns the same cached array on repeat calls', () => {
    expect(loadDestinations()).toBe(loadDestinations());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter voyager-server test src/__tests__/data/loadDestinations.test.ts`
Expected: FAIL, cannot find module `app/data/loadDestinations.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Loads and caches the curated destination catalog. The server's source of
 * truth for discovery ranking; reads the JSON asset (copied to dist at build)
 * once and memoizes it so ranking calls never touch the filesystem twice.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface DestinationExperience {
  category: string;
  description: string;
  estimated_cost: number;
  name: string;
}

export interface DestinationDining {
  cuisine: string;
  description: string;
  name: string;
  price_level: 1 | 2 | 3 | 4;
}

export interface DestinationWeather {
  high_c: number;
  low_c: number;
  month: string;
  rainfall_mm: number;
}

export interface Destination {
  best_season: string;
  categories: string[];
  country: string;
  currency: string;
  description: string;
  dining_highlights: DestinationDining[];
  estimated_daily_budget: { budget: number; luxury: number; mid: number };
  language: string;
  name: string;
  neighborhoods: Array<{ description: string; name: string }>;
  price_level: 1 | 2 | 3 | 4;
  slug: string;
  top_experiences: DestinationExperience[];
  visa_summary: string;
  weather: DestinationWeather[];
}

let cachedDestinations: Destination[] | null = null;

export function loadDestinations(): Destination[] {
  if (cachedDestinations) return cachedDestinations;
  const dataDir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(dataDir, 'destinations.json'), 'utf-8');
  cachedDestinations = JSON.parse(raw) as Destination[];
  return cachedDestinations;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter voyager-server test src/__tests__/data/loadDestinations.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/data/loadDestinations.ts apps/server/src/__tests__/data/loadDestinations.test.ts
git commit -m "feat(discovery): server destination catalog loader

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `discover_destinations` ranking logic

**Files:**

- Create: `apps/server/src/tools/discoverDestinationsTool.ts`
- Test: `apps/server/src/__tests__/tools/discoverDestinations.test.ts`

**Interfaces:**

- Consumes: `loadDestinations`, `Destination` from Task 1; `Offer` from `@repo/types`.
- Produces: `interface DiscoverDestinationsInput`; `interface DiscoverDestinationsResult { destinations: Offer[]; status: 'no_results' | 'ok' }`; `function discoverDestinations(input: DiscoverDestinationsInput): DiscoverDestinationsResult`.

Note: `region` is intentionally omitted from Phase 1. The catalog carries no region field, so a region filter would be non-functional. Revisit with catalog expansion. Climate is derived from monthly weather: warm if the reference month's `high_c` is at least 24, cold if below 15, otherwise mild. When a month is given it is the reference month; otherwise the annual average high is used.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';

import { discoverDestinations } from 'app/tools/discoverDestinationsTool.js';

describe('discoverDestinations', () => {
  it('returns warm, budget destinations for a warm-and-cheap query', () => {
    const result = discoverDestinations({
      climate: 'warm',
      max_price_level: 2,
      month: 'February',
    });
    expect(result.status).toBe('ok');
    expect(result.destinations.length).toBeGreaterThan(0);
    for (const offer of result.destinations) {
      expect(Number(offer.detail?.price_level)).toBeLessThanOrEqual(2);
      expect(offer.price_unit).toBe('per_day');
    }
  });

  it('ranks vibe matches ahead of non-matches', () => {
    const result = discoverDestinations({ limit: 30, vibes: ['beach'] });
    const first = result.destinations[0];
    expect(String(first.badges?.join(' ')).toLowerCase()).toContain('beach');
  });

  it('honors the limit', () => {
    expect(discoverDestinations({ limit: 3 }).destinations).toHaveLength(3);
  });

  it('returns no_results when no destination satisfies the hard filters', () => {
    const result = discoverDestinations({ max_daily_budget_usd: 1 });
    expect(result.status).toBe('no_results');
    expect(result.destinations).toEqual([]);
  });

  it('does not invent a price: uses the curated per-day budget estimate', () => {
    const [offer] = discoverDestinations({ limit: 1 }).destinations;
    expect(offer.price).toBeGreaterThan(0);
    expect(offer.currency).toBe('USD');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter voyager-server test src/__tests__/tools/discoverDestinations.test.ts`
Expected: FAIL, cannot find module `app/tools/discoverDestinationsTool.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * discover_destinations logic: ranks the curated catalog by soft travel
 * criteria (vibe, budget, month, climate) and returns the best matches as
 * generic Offers for a destination offer_tiles node. Pure and deterministic:
 * no network, no SerpApi, curated data only.
 */
import type { Offer } from '@repo/types';

import type { Destination } from 'app/data/loadDestinations.js';
import { loadDestinations } from 'app/data/loadDestinations.js';

export type Climate = 'cold' | 'mild' | 'warm';

export interface DiscoverDestinationsInput {
  climate?: Climate;
  limit?: number;
  max_daily_budget_usd?: number;
  max_price_level?: 1 | 2 | 3 | 4;
  month?: string;
  vibes?: string[];
}

export interface DiscoverDestinationsResult {
  destinations: Offer[];
  status: 'no_results' | 'ok';
}

const DEFAULT_LIMIT = 5;
const WARM_HIGH_C = 24;
const COLD_HIGH_C = 15;
const VIBE_MATCH_SCORE = 2;
const SEASON_MATCH_SCORE = 1;

export function discoverDestinations(
  input: DiscoverDestinationsInput,
): DiscoverDestinationsResult {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const survivors = loadDestinations().filter((d) =>
    passesHardFilters(d, input),
  );
  if (survivors.length === 0) return { destinations: [], status: 'no_results' };

  const ranked = survivors
    .map((d) => ({ destination: d, score: scoreDestination(d, input) }))
    .sort(compareRanked)
    .slice(0, limit)
    .map((entry) => toOffer(entry.destination));

  return { destinations: ranked, status: 'ok' };
}

function passesHardFilters(
  destination: Destination,
  input: DiscoverDestinationsInput,
): boolean {
  if (
    input.max_price_level &&
    destination.price_level > input.max_price_level
  ) {
    return false;
  }
  if (
    input.max_daily_budget_usd &&
    destination.estimated_daily_budget.budget > input.max_daily_budget_usd
  ) {
    return false;
  }
  if (
    input.climate &&
    deriveClimate(destination, input.month) !== input.climate
  ) {
    return false;
  }
  return true;
}

function scoreDestination(
  destination: Destination,
  input: DiscoverDestinationsInput,
): number {
  let score = 0;
  for (const vibe of input.vibes ?? []) {
    if (destination.categories.includes(vibe)) score += VIBE_MATCH_SCORE;
  }
  if (
    input.month &&
    destination.best_season.toLowerCase().includes(input.month.toLowerCase())
  ) {
    score += SEASON_MATCH_SCORE;
  }
  return score;
}

function compareRanked(
  a: { destination: Destination; score: number },
  b: { destination: Destination; score: number },
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.destination.price_level !== b.destination.price_level) {
    return a.destination.price_level - b.destination.price_level;
  }
  return a.destination.name.localeCompare(b.destination.name);
}

function deriveClimate(destination: Destination, month?: string): Climate {
  const highs = destination.weather.map((w) => w.high_c);
  const referenceHigh = month
    ? (destination.weather.find(
        (w) => w.month.toLowerCase() === month.toLowerCase(),
      )?.high_c ?? averageOf(highs))
    : averageOf(highs);
  if (referenceHigh >= WARM_HIGH_C) return 'warm';
  if (referenceHigh < COLD_HIGH_C) return 'cold';
  return 'mild';
}

function averageOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toOffer(destination: Destination): Offer {
  return {
    badges: [destination.best_season, ...destination.categories.slice(0, 2)],
    currency: 'USD',
    detail: {
      best_season: destination.best_season,
      daily_budget_mid: destination.estimated_daily_budget.mid,
      price_level: destination.price_level,
    },
    id: destination.slug,
    price: destination.estimated_daily_budget.budget,
    price_unit: 'per_day',
    selection_label: destination.name,
    subtitle: destination.country,
    title: destination.name,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter voyager-server test src/__tests__/tools/discoverDestinations.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/tools/discoverDestinationsTool.ts apps/server/src/__tests__/tools/discoverDestinations.test.ts
git commit -m "feat(discovery): discover_destinations ranking over curated catalog

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Register and dispatch the tool

**Files:**

- Create: `apps/server/src/tools/registry/discoverDestinations.ts`
- Modify: `apps/server/src/tools/schemas.ts` (add one re-export)
- Modify: `apps/server/src/tools/registry/toolRegistry.ts` (import + array entry)
- Modify: `apps/server/src/tools/executor.ts` (import + switch case)
- Test: `apps/server/src/__tests__/tools/executor.discover.test.ts`

**Interfaces:**

- Consumes: `discoverDestinations` (Task 2); `ToolModule`, `parseInput` (existing).
- Produces: `discoverDestinationsSchema`, `discoverDestinationsTool`; the `discover_destinations` case in `executeTool`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';

import { executeTool } from 'app/tools/executor.js';

describe('executeTool: discover_destinations', () => {
  it('returns ranked destinations for a valid query', async () => {
    const result = (await executeTool('discover_destinations', {
      climate: 'warm',
      limit: 3,
    })) as { destinations: unknown[]; status: string };
    expect(result.status).toBe('ok');
    expect(result.destinations.length).toBeGreaterThan(0);
    expect(result.destinations.length).toBeLessThanOrEqual(3);
  });

  it('returns a validation error for a malformed limit', async () => {
    const result = (await executeTool('discover_destinations', {
      limit: 99,
    })) as { error?: string };
    expect(result.error).toContain('Validation failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter voyager-server test src/__tests__/tools/executor.discover.test.ts`
Expected: FAIL, `executeTool` falls through the switch and returns undefined (no `status`).

- [ ] **Step 3a: Create the schema module** `apps/server/src/tools/registry/discoverDestinations.ts`:

```typescript
/** discover_destinations tool: rank curated destinations by travel criteria. */
import { z } from 'zod';

import type { ToolModule } from 'app/tools/registry/toolModule.js';

export const discoverDestinationsSchema = z.object({
  climate: z
    .enum(['warm', 'mild', 'cold'])
    .optional()
    .describe('Desired climate for the trip month.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe('Maximum destinations to return (default 5).'),
  max_daily_budget_usd: z
    .number()
    .positive()
    .optional()
    .describe('Upper bound on the budget daily spend in USD.'),
  max_price_level: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .optional()
    .describe('Upper bound on cost tier: 1 cheapest, 4 priciest.'),
  month: z
    .string()
    .optional()
    .describe('Travel month, e.g. February; sets the climate reference.'),
  vibes: z
    .array(
      z.enum([
        'adventure',
        'beach',
        'budget',
        'city',
        'culture',
        'family',
        'food-wine',
        'romantic',
      ]),
    )
    .optional()
    .describe('Trip vibes to prefer when ranking.'),
});

export const discoverDestinationsTool: ToolModule = {
  description:
    'Suggest candidate destinations for a user who has not chosen where to go, ranked from the curated catalog by climate, budget, travel month, and vibe. Use this in the discovery phase to answer open-ended questions like "somewhere warm and cheap in February". Returns destination cards; do not restate their contents. Budgets are curated per-day estimates, not live prices.',
  name: 'discover_destinations',
  schema: discoverDestinationsSchema,
};
```

- [ ] **Step 3b: Re-export the schema** in `apps/server/src/tools/schemas.ts` (keep the list alphabetized by export name):

```typescript
export { discoverDestinationsSchema } from 'app/tools/registry/discoverDestinations.js';
```

- [ ] **Step 3c: Register in the tool registry** `apps/server/src/tools/registry/toolRegistry.ts`. Add the import beside the others and append to the array after `searchExperiencesTool`:

```typescript
import { discoverDestinationsTool } from 'app/tools/registry/discoverDestinations.js';
```

```typescript
export const TOOL_REGISTRY: ToolModule[] = [
  searchFlightsTool,
  searchHotelsTool,
  searchExperiencesTool,
  discoverDestinationsTool,
  calculateRemainingBudgetTool,
  // ...unchanged...
];
```

- [ ] **Step 3d: Dispatch in the executor** `apps/server/src/tools/executor.ts`. Add the imports (with the other `app/tools/*Tool.js` and `app/tools/schemas.js` imports) and a switch case beside `get_destination_info`:

```typescript
import { discoverDestinations } from 'app/tools/discoverDestinationsTool.js';
```

```typescript
import {
  // ...existing named schema imports...
  discoverDestinationsSchema,
} from 'app/tools/schemas.js';
```

```typescript
    case 'discover_destinations': {
      const parsed = parseInput(toolName, discoverDestinationsSchema, input);
      if ('error' in parsed) return parsed;
      return discoverDestinations(parsed.data);
    }
```

- [ ] **Step 4: Run the test and the tool-definition test**

Run: `pnpm --filter voyager-server test src/__tests__/tools/executor.discover.test.ts src/__tests__/tools/definitions.test.ts`
Expected: PASS. (The definitions test derives from `TOOL_REGISTRY`; confirm the new tool did not break derivation.)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/tools/registry/discoverDestinations.ts apps/server/src/tools/schemas.ts apps/server/src/tools/registry/toolRegistry.ts apps/server/src/tools/executor.ts apps/server/src/__tests__/tools/executor.discover.test.ts
git commit -m "feat(discovery): register and dispatch discover_destinations

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Widen `OfferKind` and emit a destination `offer_tiles` node

**Files:**

- Modify: `packages/types/src/segments.ts` (widen `OfferKind`)
- Modify: `apps/server/src/services/agent/nodeBuilder.ts` (add the `discover_destinations` arm)
- Test: `apps/server/src/__tests__/services/agent/nodeBuilder.test.ts` (extend)

**Interfaces:**

- Consumes: the `discover_destinations` result `{ destinations: Offer[]; status }` (Task 2/3).
- Produces: `OfferKind = SegmentKind | 'destination'`; a `{ type: 'offer_tiles'; offer_kind: 'destination'; offers; selectable: true }` node from `buildNodeFromToolResult('discover_destinations', ...)`.

- [ ] **Step 1: Write the failing test** (append to the existing `nodeBuilder.test.ts`)

```typescript
import type { Offer } from '@repo/types';

it('builds a destination offer_tiles node from discover_destinations', () => {
  const offers: Offer[] = [
    { currency: 'USD', id: 'lisbon', price: 90, title: 'Lisbon' },
  ];
  const node = buildNodeFromToolResult('discover_destinations', {
    destinations: offers,
    status: 'ok',
  });
  expect(node).toEqual({
    offer_kind: 'destination',
    offers,
    selectable: true,
    type: 'offer_tiles',
  });
});

it('returns null when discovery found no destinations', () => {
  const node = buildNodeFromToolResult('discover_destinations', {
    destinations: [],
    status: 'no_results',
  });
  expect(node).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter voyager-server test src/__tests__/services/agent/nodeBuilder.test.ts`
Expected: FAIL, node is `null` for the first case (no arm yet).

- [ ] **Step 3a: Widen `OfferKind`** in `packages/types/src/segments.ts`:

```typescript
export type OfferKind = SegmentKind | 'destination';
```

- [ ] **Step 3b: Add the nodeBuilder arm** in `apps/server/src/services/agent/nodeBuilder.ts`. Add `Offer` to the type import and a branch before the final `return null`:

```typescript
import type { ChatNode, Offer } from '@repo/types';
```

```typescript
  if (toolName === 'discover_destinations') {
    const offers = (result as { destinations?: Offer[] }).destinations ?? [];
    if (offers.length === 0) return null;
    return {
      offer_kind: 'destination',
      offers,
      selectable: true,
      type: 'offer_tiles',
    };
  }

  return null;
```

- [ ] **Step 4: Run tests and a type build**

Run: `pnpm --filter voyager-server test src/__tests__/services/agent/nodeBuilder.test.ts`
Expected: PASS.
Run: `pnpm --filter voyager-server build`
Expected: PASS. Widening `OfferKind` is source-compatible. If the compiler flags any site that assumed `OfferKind === SegmentKind` (for example an exhaustive `switch` over offer kinds), fix that site here as part of this task by adding a `destination` branch or a default. The client offer-card registry needs no change (it is `Partial<Record<OfferKind, ...>>` with a fallback).

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/segments.ts apps/server/src/services/agent/nodeBuilder.ts apps/server/src/__tests__/services/agent/nodeBuilder.test.ts
git commit -m "feat(discovery): destination offer-kind and offer_tiles node

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `DestinationOfferCard` and registry entry

**Files:**

- Create: `apps/client/web/src/components/ChatBox/nodes/offerCards/DestinationOfferCard.tsx`
- Create: `apps/client/web/src/components/ChatBox/nodes/offerCards/DestinationOfferCard.module.scss`
- Modify: `apps/client/web/src/components/ChatBox/nodes/offerCardRegistry.tsx`
- Test: `apps/client/web/src/__tests__/components/ChatBox/nodes/DestinationOfferCard.test.tsx`

**Interfaces:**

- Consumes: a destination `Offer` (title = name, subtitle = country, `detail.price_level`, `detail.best_season`, `badges`, `price`); the existing `getDestinationImage` util at `@/services/destinationImage`.
- Produces: `DestinationOfferCard`; `OFFER_CARD_REGISTRY['destination']` with `selectionMessage: (label) => 'Let us plan a trip to ' + label`.

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { buildOfferSelectionMessage } from '@/components/ChatBox/nodes/offerCardRegistry';
import { DestinationOfferCard } from '@/components/ChatBox/nodes/offerCards/DestinationOfferCard';

const offer = {
  badges: ['June - August', 'beach'],
  currency: 'USD',
  detail: { best_season: 'June - August', price_level: 2 },
  id: 'lisbon',
  price: 90,
  price_unit: 'per_day' as const,
  subtitle: 'Portugal',
  title: 'Lisbon',
};

describe('DestinationOfferCard', () => {
  it('shows the destination name, country, and estimated per-day budget', () => {
    render(<DestinationOfferCard offer={offer} />);
    expect(screen.getByText('Lisbon')).toBeInTheDocument();
    expect(screen.getByText('Portugal')).toBeInTheDocument();
    expect(screen.getByText(/\$90\/day \(est\.\)/)).toBeInTheDocument();
  });

  it('fires onClick when selected', () => {
    const onClick = vi.fn();
    render(<DestinationOfferCard offer={offer} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('registers a planning-commit selection message for destinations', () => {
    expect(buildOfferSelectionMessage('destination', 'Lisbon')).toBe(
      'Let us plan a trip to Lisbon',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter voyager-web test src/__tests__/components/ChatBox/nodes/DestinationOfferCard.test.tsx`
Expected: FAIL, cannot resolve `DestinationOfferCard`.

- [ ] **Step 3a: Create the card** `apps/client/web/src/components/ChatBox/nodes/offerCards/DestinationOfferCard.tsx`:

```tsx
/** Presents a destination Offer as a grazing card that commits into planning. */
import Image from 'next/image';

import type { Offer } from '@repo/types';

import { getDestinationImage } from '@/services/destinationImage';

import styles from './DestinationOfferCard.module.scss';

interface OfferCardProps {
  offer: Offer;
  onClick?: () => void;
  selected?: boolean;
}

export function DestinationOfferCard({
  offer,
  onClick,
  selected,
}: OfferCardProps) {
  const { url } = getDestinationImage(offer.title);
  return (
    <button
      type='button'
      className={selected ? styles.cardSelected : styles.card}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={styles.image}>
        {url ? <Image src={url} alt={offer.title} fill sizes='240px' /> : null}
      </span>
      <span className={styles.name}>{offer.title}</span>
      {offer.subtitle ? (
        <span className={styles.country}>{offer.subtitle}</span>
      ) : null}
      <span
        className={styles.budget}
      >{`from ~$${offer.price}/day (est.)`}</span>
      <span className={styles.badges}>
        {(offer.badges ?? []).map((badge) => (
          <span key={badge} className={styles.badge}>
            {badge}
          </span>
        ))}
      </span>
    </button>
  );
}
```

Create the sibling `DestinationOfferCard.module.scss` following the styling of the existing cards under `components/ChatBox/widgets/` (reuse the same tokens and card radius/shadow). Minimum classes: `card`, `cardSelected`, `image`, `name`, `country`, `budget`, `badges`, `badge`.

- [ ] **Step 3b: Register the card** in `apps/client/web/src/components/ChatBox/nodes/offerCardRegistry.tsx`. Add the import and a `destination` entry (keep entries alphabetized):

```tsx
import { DestinationOfferCard } from './offerCards/DestinationOfferCard';
```

```tsx
  destination: {
    Card: DestinationOfferCard,
    heightEstimate: 300,
    selectionMessage: (label) => `Let us plan a trip to ${label}`,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter voyager-web test src/__tests__/components/ChatBox/nodes/DestinationOfferCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/client/web/src/components/ChatBox/nodes/offerCards/DestinationOfferCard.tsx apps/client/web/src/components/ChatBox/nodes/offerCards/DestinationOfferCard.module.scss apps/client/web/src/components/ChatBox/nodes/offerCardRegistry.tsx apps/client/web/src/__tests__/components/ChatBox/nodes/DestinationOfferCard.test.tsx
git commit -m "feat(discovery): destination offer card and registry entry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: The `DISCOVER` flow phase and `discover` sub-agent

**Files:**

- Modify: `apps/server/src/prompts/bookingSteps.ts` (`FlowPosition` union + `getFlowPosition` guard)
- Modify: `apps/server/src/services/agent/subAgentTypes.ts` (add `'discover'`)
- Modify: `apps/server/src/services/agent/isCoreSubAgent.ts` (recognize `'discover'`)
- Modify: `apps/server/src/services/agent/coreSubAgentTools.ts` (add the `discover` partition)
- Modify: `apps/server/src/services/agent/selectSubAgent.ts` (route `DISCOVER` to `discover`)
- Modify: `apps/server/src/prompts/systemPrompt.ts` (`DISCOVER` addendum)
- Test: `apps/server/src/__tests__/prompts/bookingSteps.test.ts` (extend), `apps/server/src/__tests__/services/agent/selectSubAgent.test.ts` (extend or create)

**Interfaces:**

- Consumes: `TripState.destination` (empty string means undecided), the tool names `discover_destinations`, `search_experiences`, `update_trip`, `get_destination_info`, `format_response`.
- Produces: `FlowPosition` variant `{ phase: 'DISCOVER' }`; `SubAgentType` member `'discover'`; `CORE_SUB_AGENT_TOOLS.discover`.

- [ ] **Step 1: Write the failing tests**

Append to `bookingSteps.test.ts`:

```typescript
it('routes an undecided trip (no destination) to DISCOVER', () => {
  const trip = { ...baseTripState(), destination: '', status: 'planning' };
  expect(getFlowPosition(trip)).toEqual({ phase: 'DISCOVER' });
});

it('still routes to COLLECT_DETAILS once a destination is chosen', () => {
  const trip = {
    ...baseTripState(),
    destination: 'Lisbon',
    origin: null,
    status: 'planning',
  };
  expect(getFlowPosition(trip)).toEqual({ phase: 'COLLECT_DETAILS' });
});
```

(Use the file's existing helper for a base `TripState`. If none exists, build a literal with every field, `destination` set as shown.)

Create `selectSubAgent.test.ts` (or append if present):

```typescript
import { describe, expect, it } from 'vitest';

import { createInitialTracker } from 'app/prompts/bookingSteps.js';
import { getSubAgentTools } from 'app/services/agent/getSubAgentTools.js';
import { selectSubAgent } from 'app/services/agent/selectSubAgent.js';

describe('discover sub-agent', () => {
  it('selects the discover sub-agent in the DISCOVER phase', () => {
    expect(selectSubAgent({ phase: 'DISCOVER' }, createInitialTracker())).toBe(
      'discover',
    );
  });

  it('gives the discover sub-agent its grazing tools', () => {
    const tools = getSubAgentTools('discover');
    expect(tools).toContain('discover_destinations');
    expect(tools).toContain('search_experiences');
    expect(tools).toContain('update_trip');
    expect(tools).not.toContain('search_flights');
  });
});
```

(If the tracker factory has a different name, use the one the file exports; the point is a default tracker.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter voyager-server test src/__tests__/prompts/bookingSteps.test.ts src/__tests__/services/agent/selectSubAgent.test.ts`
Expected: FAIL, `DISCOVER` is not a valid `FlowPosition`/`SubAgentType` and `getFlowPosition` returns `COLLECT_DETAILS`.

- [ ] **Step 3a: Add the phase** in `apps/server/src/prompts/bookingSteps.ts`:

```typescript
export type FlowPosition =
  | { phase: 'COLLECT_DETAILS' }
  | { phase: 'COMPLETE' }
  | { phase: 'DISCOVER' }
  | { phase: 'PLAN_TRIP' }
  | { phase: 'PLANNING' };
```

Add the guard at the top of `getFlowPosition`, after the `COMPLETE` (`status !== 'planning'`) check and before the origin/dates gate:

```typescript
  if (trip.destination.trim() === '') {
    return { phase: 'DISCOVER' };
  }
```

- [ ] **Step 3b: Add the sub-agent type** in `apps/server/src/services/agent/subAgentTypes.ts`:

```typescript
export type SubAgentType =
  | 'conversation'
  | 'detail'
  | 'discover'
  | 'plan'
  | SegmentKind;
```

- [ ] **Step 3c: Recognize it as core** in `apps/server/src/services/agent/isCoreSubAgent.ts`:

```typescript
  return (
    subAgent === 'detail' ||
    subAgent === 'discover' ||
    subAgent === 'plan' ||
    subAgent === 'conversation'
  );
```

- [ ] **Step 3d: Add the tool partition** in `apps/server/src/services/agent/coreSubAgentTools.ts` (alphabetized key):

```typescript
  discover: [
    'discover_destinations',
    'search_experiences',
    'get_destination_info',
    'update_trip',
    'format_response',
  ],
```

- [ ] **Step 3e: Route to it** in `apps/server/src/services/agent/selectSubAgent.ts`, with the other fixed-phase branches:

```typescript
  if (flowPosition.phase === 'DISCOVER') return 'discover';
```

- [ ] **Step 3f: Add the prompt addendum** in `apps/server/src/prompts/systemPrompt.ts`. Define the constant beside the other addenda and push it first in the phase branch of `buildSystemPrompt`:

```typescript
const DISCOVER_ADDENDUM = `\n\n## Current Phase: Discovery
The user has not chosen a destination. Do not present the trip-details form. Help them decide where to go and answer open-ended, curiosity-driven questions.
- Call discover_destinations to surface candidate places from criteria like climate, budget, month, or vibe. It returns destination cards; never restate what a card shows.
- Call search_experiences for in-place curiosity ("good restaurants in Lisbon", "what is worth doing there").
- Present only grounded facts. Budgets are curated estimates; write them as "from ~$X/day (est.)" and never invent live prices.
- When the user commits to a place (picks a card or names one), call update_trip with that destination, then help collect trip details.
Keep replies under ~100 words.`;
```

```typescript
// Phase-specific addendum
if (flowPosition?.phase === 'DISCOVER') {
  parts.push(DISCOVER_ADDENDUM);
} else if (!flowPosition || flowPosition.phase === 'COLLECT_DETAILS') {
  parts.push(COLLECT_DETAILS_ADDENDUM);
} else if (flowPosition.phase === 'COMPLETE') {
  parts.push(COMPLETE_ADDENDUM);
}
```

- [ ] **Step 4: Run the tests and the full server suite**

Run: `pnpm --filter voyager-server test src/__tests__/prompts/bookingSteps.test.ts src/__tests__/services/agent/selectSubAgent.test.ts`
Expected: PASS.
Run: `pnpm --filter voyager-server test`
Expected: PASS. `getFlowPosition` now returns `DISCOVER` only when `destination` is empty. Any existing test that built a `TripState` with an empty destination expecting `COLLECT_DETAILS` must be updated to set a destination (that is the corrected behavior). Confirm no other regressions.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/prompts/bookingSteps.ts apps/server/src/services/agent/subAgentTypes.ts apps/server/src/services/agent/isCoreSubAgent.ts apps/server/src/services/agent/coreSubAgentTools.ts apps/server/src/services/agent/selectSubAgent.ts apps/server/src/prompts/systemPrompt.ts apps/server/src/__tests__/prompts/bookingSteps.test.ts apps/server/src/__tests__/services/agent/selectSubAgent.test.ts
git commit -m "feat(discovery): DISCOVER phase and discover sub-agent

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: ChatBox invariant and full verification

**Files:**

- Modify: `apps/client/web/src/__tests__/components/ChatBox/ChatBox.invariants.test.tsx`

**Interfaces:**

- Consumes: everything above; asserts the client renders and persists a destination `offer_tiles` node.

- [ ] **Step 1: Extend the invariants spec**

Add an invariant to the existing file (do not create a new test file, per repo rule): a destination `offer_tiles` node with `offer_kind: 'destination'` renders its cards, and those cards persist after the SSE stream ends. Mirror the existing tool-result-card-persist invariant, substituting the destination node below, and use the file's real render/stream-end helpers in place of the placeholder call.

```tsx
it('persists destination discovery cards after the stream ends', () => {
  const node = {
    offer_kind: 'destination' as const,
    offers: [
      { currency: 'USD', id: 'lisbon', price: 90, title: 'Lisbon' },
      { currency: 'USD', id: 'porto', price: 75, title: 'Porto' },
    ],
    selectable: true,
    type: 'offer_tiles' as const,
  };
  // Follow the existing invariant's pattern: render with the node, end the
  // stream, then assert both destination titles remain in the document.
  renderChatWithNodesThenEndStream([node]);
  expect(screen.getByText('Lisbon')).toBeInTheDocument();
  expect(screen.getByText('Porto')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the invariants test**

Run: `pnpm --filter voyager-web test src/__tests__/components/ChatBox/ChatBox.invariants.test.tsx`
Expected: PASS.

- [ ] **Step 3: Full verification chain**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`
Expected: all PASS. Fix any formatting or lint findings in the files this plan touched.

- [ ] **Step 4: Commit**

```bash
git add apps/client/web/src/__tests__/components/ChatBox/ChatBox.invariants.test.tsx
git commit -m "test(discovery): destination-tiles persistence invariant

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** Move 1 (`discover_destinations`) is Tasks 1 to 3. Move 2 (`destination` offer-kind + card) is Tasks 4 and 5. Move 3 (`DISCOVER` phase + prompt) is Task 6. Move 4 (pivot + live blend) is emergent in Task 6 (the addendum instructs `update_trip`, which advances `getFlowPosition`) plus the `search_experiences` tool already in the `discover` partition. Testing and the ChatBox invariant is Task 7. The two flagged central edits (widen `OfferKind`, `DISCOVER` phase) are Tasks 4 and 6.

**Deviations from the spec, made explicit:** `region` is dropped from the tool schema because the catalog has no region field (a region filter would be non-functional); noted in Task 2. The KB is not used for grounding (curated catalog read directly), matching the spec's "reads the catalog directly" decision.

**Open confirmations for the implementer:** the `TripState` base-object helper name in `bookingSteps.test.ts`; the tracker-factory name for the `selectSubAgent` test; the invariants file's render/stream-end helper names. Each is a local lookup in the named test file, not a design gap.
