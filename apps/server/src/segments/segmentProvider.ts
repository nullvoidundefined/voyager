/**
 * Provider contract for segment searches: a structured API when the mode has
 * one, and cold-path web discovery for everything else. The Redis cache, KB
 * read, write-back, and confidence updates live in runSegmentSearch so no
 * provider re-implements them.
 */
import type { Offer, SegmentKind } from '@repo/types';

import type { ProvenanceEntry } from 'app/repositories/inventory/inventoryTypes.js';

export interface SegmentSearchInput {
  kind: SegmentKind;
  /** Normalized region/country key, e.g. 'romania'. */
  region: string;
  /** Normalized origin->destination or loop key, when route-shaped. */
  routeKey?: string;
  /** The search tool's validated Zod payload, passed through to fromApi. */
  params: Record<string, unknown>;
  requestId?: string;
}

export interface DiscoveredOffer extends Offer {
  provenance: ProvenanceEntry[];
  region: string;
  route_key?: string;
}

export interface SegmentProvider {
  /** Structured API first (if the mode has one); undefined falls through. */
  fromApi?(input: SegmentSearchInput): Promise<Offer[] | undefined>;
  /** Cold-path discovery via web search; returns normalized offers + provenance. */
  fromWeb(input: SegmentSearchInput): Promise<DiscoveredOffer[]>;
}
