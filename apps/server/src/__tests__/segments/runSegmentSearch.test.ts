import { describe, expect, it, vi } from 'vitest';

import { experienceCapability } from 'app/segments/registry/experience.js';
import { flightCapability } from 'app/segments/registry/flight.js';
import type { SegmentSearchDeps } from 'app/segments/runSegmentSearch.js';
import { runSegmentSearch } from 'app/segments/runSegmentSearch.js';

const RAW_FLIGHT = {
  airline: 'Delta',
  flight_number: 'DL123',
  origin: 'JFK',
  destination: 'NRT',
  departure_time: '2026-05-01T08:00:00',
  price: 850,
  currency: 'USD',
};

const FLIGHT_INPUT = {
  kind: 'flight' as const,
  region: 'nrt',
  routeKey: 'jfk->nrt',
  params: { origin: 'JFK', destination: 'NRT' },
};

function makeDeps(
  overrides: Partial<SegmentSearchDeps> = {},
): SegmentSearchDeps {
  return {
    findInventoryItems: vi.fn().mockResolvedValue([]),
    upsertDiscoveredItems: vi.fn().mockResolvedValue(1),
    recordInventoryHit: vi.fn().mockResolvedValue(undefined),
    discoverOffersViaWeb: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function freshInventoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    kind: 'flight',
    region: 'nrt',
    route_key: 'jfk->nrt',
    title: 'Delta DL123',
    provider: 'Delta',
    attributes: RAW_FLIGHT,
    indicative_price: 850,
    currency: 'USD',
    booking_url: null,
    source: 'serpapi' as const,
    provenance: [],
    confidence: 0.55,
    hit_count: 0,
    first_seen_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('runSegmentSearch', () => {
  it('api success passes the outcome through and writes back to the knowledge base', async () => {
    const deps = makeDeps();
    const fromApi = vi
      .fn()
      .mockResolvedValue({ status: 'ok', flights: [RAW_FLIGHT] });

    const result = await runSegmentSearch(
      flightCapability,
      FLIGHT_INPUT,
      fromApi,
      deps,
    );

    expect(result.source).toBe('api');
    expect(result.indicative).toBe(false);
    expect(result.outcome).toEqual({ status: 'ok', flights: [RAW_FLIGHT] });
    expect(deps.upsertDiscoveredItems).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'flight',
        region: 'nrt',
        route_key: 'jfk->nrt',
        title: 'Delta DL123',
        source: 'serpapi',
        attributes: RAW_FLIGHT,
        indicative_price: 850,
      }),
    ]);
  });

  it('quota exhaustion with fresh catalog rows serves indicative results and records hits', async () => {
    const deps = makeDeps({
      findInventoryItems: vi.fn().mockResolvedValue([freshInventoryRow()]),
    });
    const fromApi = vi.fn().mockResolvedValue({
      status: 'quota_exhausted',
      flights: [],
      message: 'monthly quota reached',
    });

    const result = await runSegmentSearch(
      flightCapability,
      FLIGHT_INPUT,
      fromApi,
      deps,
    );

    expect(result.source).toBe('knowledge_base');
    expect(result.indicative).toBe(true);
    const outcome = result.outcome as {
      status: string;
      indicative: boolean;
      flights: unknown[];
    };
    expect(outcome.status).toBe('ok');
    expect(outcome.indicative).toBe(true);
    expect(outcome.flights).toEqual([RAW_FLIGHT]);
    expect(deps.recordInventoryHit).toHaveBeenCalledWith('inv-1');
  });

  it('quota exhaustion with only stale rows passes the quota outcome through', async () => {
    const staleDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const deps = makeDeps({
      findInventoryItems: vi
        .fn()
        .mockResolvedValue([
          freshInventoryRow({ last_verified_at: staleDate }),
        ]),
    });
    const quotaOutcome = {
      status: 'quota_exhausted',
      flights: [],
      message: 'monthly quota reached',
    };
    const fromApi = vi.fn().mockResolvedValue(quotaOutcome);

    const result = await runSegmentSearch(
      flightCapability,
      FLIGHT_INPUT,
      fromApi,
      deps,
    );

    expect(result.source).toBe('none');
    expect(result.outcome).toBe(quotaOutcome);
  });

  it('non-quota failures pass through without consulting the knowledge base', async () => {
    const deps = makeDeps();
    const errorOutcome = { status: 'timeout', flights: [] };
    const fromApi = vi.fn().mockResolvedValue(errorOutcome);

    const result = await runSegmentSearch(
      flightCapability,
      FLIGHT_INPUT,
      fromApi,
      deps,
    );

    expect(result.outcome).toBe(errorOutcome);
    expect(deps.findInventoryItems).not.toHaveBeenCalled();
  });

  it('web-first capability: cold path discovers, writes back, and serves indicative offers', async () => {
    const webCapability = {
      ...experienceCapability,
      webDiscovery: {
        buildQuery: () => 'luxury sleeper train Romania',
      },
    };
    const discovered = {
      id: 'web-1',
      title: 'Carpathia Express',
      selection_label: 'Carpathia Express',
      price: 89,
      currency: 'EUR',
      price_unit: 'per_person' as const,
      badges: [],
      detail: { title: 'Carpathia Express' },
      provenance: [
        { url: 'https://cfr.example', fetched_at: '2026-07-06T00:00:00Z' },
      ],
      region: 'romania',
      route_key: 'bucharest->brasov',
    };
    const deps = makeDeps({
      discoverOffersViaWeb: vi.fn().mockResolvedValue([discovered]),
    });

    const result = await runSegmentSearch(
      webCapability,
      { kind: 'experience', region: 'romania', params: {} },
      undefined,
      deps,
    );

    expect(result.source).toBe('web');
    expect(result.indicative).toBe(true);
    expect(deps.upsertDiscoveredItems).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'Carpathia Express',
        source: 'web_search',
        region: 'romania',
      }),
    ]);
    const outcome = result.outcome as {
      status: string;
      experiences: unknown[];
    };
    expect(outcome.status).toBe('ok');
    expect(outcome.experiences).toHaveLength(1);
  });

  it('web-first capability with nothing anywhere returns no_results', async () => {
    const webCapability = {
      ...experienceCapability,
      webDiscovery: { buildQuery: () => 'query' },
    };
    const deps = makeDeps();

    const result = await runSegmentSearch(
      webCapability,
      { kind: 'experience', region: 'nowhere', params: {} },
      undefined,
      deps,
    );

    expect(result.source).toBe('none');
    const outcome = result.outcome as { status: string };
    expect(outcome.status).toBe('no_results');
  });

  it('knowledge-base write-back failures never break a successful search', async () => {
    const deps = makeDeps({
      upsertDiscoveredItems: vi.fn().mockRejectedValue(new Error('db down')),
    });
    const fromApi = vi
      .fn()
      .mockResolvedValue({ status: 'ok', flights: [RAW_FLIGHT] });

    const result = await runSegmentSearch(
      flightCapability,
      FLIGHT_INPUT,
      fromApi,
      deps,
    );
    expect(result.source).toBe('api');
    expect(result.outcome).toEqual({ status: 'ok', flights: [RAW_FLIGHT] });
  });
});
