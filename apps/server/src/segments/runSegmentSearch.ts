/**
 * The cold-to-warm segment search path, written once for every mode: run the
 * structured API when the mode has one, write successes back to the knowledge
 * base, serve fresh catalog rows when the API quota is exhausted, and fall
 * back to gated web discovery for web-first modes. Callers get the legacy
 * per-tool outcome shape back, plus where it came from and whether prices are
 * indicative.
 */
import { logger } from 'app/clients/logger.js';
import { findInventoryItems } from 'app/repositories/inventory/findInventoryItems.js';
import type {
  InventoryItem,
  NewInventoryItem,
} from 'app/repositories/inventory/inventoryTypes.js';
import { recordInventoryHit } from 'app/repositories/inventory/recordInventoryHit.js';
import { upsertDiscoveredItems } from 'app/repositories/inventory/upsertDiscoveredItems.js';
import { discoverOffersViaWeb } from 'app/segments/discoverOffersViaWeb.js';
import { extractResultItems } from 'app/segments/extractResultItems.js';
import type { SegmentCapability } from 'app/segments/segmentCapability.js';
import type {
  DiscoveredOffer,
  SegmentSearchInput,
} from 'app/segments/segmentProvider.js';

export interface SegmentSearchResult {
  /** Legacy per-tool outcome shape, returned to the agent unchanged in shape. */
  outcome: unknown;
  source: 'api' | 'knowledge_base' | 'web' | 'none';
  /** True when prices are indicative catalog values ("from ~X"). */
  indicative: boolean;
}

export interface SegmentSearchDeps {
  findInventoryItems: typeof findInventoryItems;
  upsertDiscoveredItems: typeof upsertDiscoveredItems;
  recordInventoryHit: typeof recordInventoryHit;
  discoverOffersViaWeb: typeof discoverOffersViaWeb;
}

const DEFAULT_SEGMENT_SEARCH_DEPS: SegmentSearchDeps = {
  discoverOffersViaWeb,
  findInventoryItems,
  recordInventoryHit,
  upsertDiscoveredItems,
};

/** Per-kind staleness windows: prices older than this are not blindly served. */
const KB_FRESHNESS_DAYS: Record<string, number> = {
  car_rental: 7,
  experience: 30,
  flight: 2,
  hotel: 7,
};
const DEFAULT_FRESHNESS_DAYS = 14;
const MILLISECONDS_PER_DAY = 86_400_000;

const INDICATIVE_MESSAGE =
  'Prices are indicative catalog values ("from ~X"); live-verify the specific selection before booking.';

export async function runSegmentSearch(
  capability: SegmentCapability,
  input: SegmentSearchInput,
  fromApi: ((params: Record<string, unknown>) => Promise<unknown>) | undefined,
  deps: SegmentSearchDeps = DEFAULT_SEGMENT_SEARCH_DEPS,
): Promise<SegmentSearchResult> {
  if (fromApi) {
    const outcome = await fromApi(input.params);
    if (isSuccessfulOutcome(outcome, capability.resultListKey)) {
      await writeBackApiResults(capability, input, outcome, deps);
      return { indicative: false, outcome, source: 'api' };
    }
    if (isQuotaExhausted(outcome)) {
      const warm = await serveWarmInventory(capability, input, deps);
      if (warm) return warm;
    }
    return { indicative: false, outcome, source: 'none' };
  }

  const warm = await serveWarmInventory(capability, input, deps);
  if (warm) return warm;

  const cold = await serveWebDiscovery(capability, input, deps);
  if (cold) return cold;

  return {
    indicative: false,
    outcome: { [capability.resultListKey]: [], status: 'no_results' },
    source: 'none',
  };
}

function isSuccessfulOutcome(outcome: unknown, resultListKey: string): boolean {
  const status = (outcome as { status?: unknown } | null)?.status;
  if (typeof status === 'string' && status !== 'ok') return false;
  return extractResultItems(outcome, resultListKey).length > 0;
}

function isQuotaExhausted(outcome: unknown): boolean {
  return (outcome as { status?: unknown } | null)?.status === 'quota_exhausted';
}

/** Best-effort write-back; a knowledge-base failure never breaks a search. */
async function writeBackApiResults(
  capability: SegmentCapability,
  input: SegmentSearchInput,
  outcome: unknown,
  deps: SegmentSearchDeps,
): Promise<void> {
  try {
    const items = extractResultItems(outcome, capability.resultListKey);
    if (items.length === 0) return;
    await deps.upsertDiscoveredItems(
      items.map((item) => toInventoryItemFromApi(capability, input, item)),
    );
  } catch (err) {
    logger.warn(
      { err, kind: capability.kind },
      'Knowledge-base write-back failed; search result unaffected',
    );
  }
}

function toInventoryItemFromApi(
  capability: SegmentCapability,
  input: SegmentSearchInput,
  item: unknown,
): NewInventoryItem {
  const offer = capability.toOffer(item);
  const provider = offer.detail?.provider ?? offer.detail?.airline;
  return {
    kind: capability.kind,
    region: input.region,
    route_key: input.routeKey ?? null,
    title: offer.title,
    ...(typeof provider === 'string' ? { provider } : {}),
    attributes: item as Record<string, unknown>,
    ...(offer.price > 0 ? { indicative_price: offer.price } : {}),
    currency: offer.currency,
    ...(offer.booking_url ? { booking_url: offer.booking_url } : {}),
    provenance: [],
    source: 'serpapi',
  };
}

/** Serves fresh catalog rows as an ok-shaped indicative outcome, or null. */
async function serveWarmInventory(
  capability: SegmentCapability,
  input: SegmentSearchInput,
  deps: SegmentSearchDeps,
): Promise<SegmentSearchResult | null> {
  const rows = await deps.findInventoryItems({
    kind: capability.kind,
    region: input.region,
    ...(input.routeKey ? { routeKey: input.routeKey } : {}),
  });
  const fresh = rows.filter((row) => isFreshRow(row, capability.kind));
  if (fresh.length === 0) return null;

  await Promise.all(fresh.map((row) => deps.recordInventoryHit(row.id)));
  return {
    indicative: true,
    outcome: {
      [capability.resultListKey]: fresh.map((row) => row.attributes),
      indicative: true,
      message: INDICATIVE_MESSAGE,
      status: 'ok',
    },
    source: 'knowledge_base',
  };
}

function isFreshRow(row: InventoryItem, kind: string): boolean {
  const windowDays = KB_FRESHNESS_DAYS[kind] ?? DEFAULT_FRESHNESS_DAYS;
  const ageMs = Date.now() - Date.parse(row.last_verified_at);
  return ageMs <= windowDays * MILLISECONDS_PER_DAY;
}

/** Cold path for web-first modes; discovered offers are persisted and served. */
async function serveWebDiscovery(
  capability: SegmentCapability,
  input: SegmentSearchInput,
  deps: SegmentSearchDeps,
): Promise<SegmentSearchResult | null> {
  if (!capability.webDiscovery) return null;

  const discovered = await deps.discoverOffersViaWeb({
    kind: capability.kind,
    region: input.region,
    ...(input.routeKey ? { routeKey: input.routeKey } : {}),
    query: capability.webDiscovery.buildQuery(input),
  });
  if (discovered.length === 0) return null;

  try {
    await deps.upsertDiscoveredItems(
      discovered.map((offer) => toInventoryItemFromWeb(capability.kind, offer)),
    );
  } catch (err) {
    logger.warn(
      { err, kind: capability.kind },
      'Knowledge-base write-back failed; discovery result unaffected',
    );
  }

  return {
    indicative: true,
    outcome: {
      [capability.resultListKey]: discovered,
      indicative: true,
      message: INDICATIVE_MESSAGE,
      status: 'ok',
    },
    source: 'web',
  };
}

function toInventoryItemFromWeb(
  kind: string,
  offer: DiscoveredOffer,
): NewInventoryItem {
  return {
    kind,
    region: offer.region,
    route_key: offer.route_key ?? null,
    title: offer.title,
    ...(offer.subtitle ? { provider: offer.subtitle } : {}),
    attributes: { ...(offer.detail ?? {}) },
    ...(offer.price > 0 ? { indicative_price: offer.price } : {}),
    currency: offer.currency,
    ...(offer.booking_url ? { booking_url: offer.booking_url } : {}),
    provenance: offer.provenance,
    source: 'web_search',
  };
}
