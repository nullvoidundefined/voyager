/**
 * Row and input shapes for the inventory_items knowledge base. kind is a plain
 * string (not SegmentKind): the catalog accumulates kinds ahead of their
 * segment-capability registration, so discovery never blocks on a release.
 */

export interface ProvenanceEntry {
  url: string;
  fetched_at: string;
}

export interface InventoryItem {
  id: string;
  kind: string;
  region: string;
  route_key: string | null;
  title: string;
  provider: string | null;
  attributes: Record<string, unknown>;
  indicative_price: number | null;
  currency: string | null;
  booking_url: string | null;
  source: 'web_search' | 'serpapi' | 'curated' | 'provider_api';
  provenance: ProvenanceEntry[];
  confidence: number;
  hit_count: number;
  first_seen_at: string;
  last_verified_at: string;
}

export interface NewInventoryItem {
  kind: string;
  region: string;
  route_key?: string | null;
  title: string;
  provider?: string;
  attributes?: Record<string, unknown>;
  indicative_price?: number;
  currency?: string;
  booking_url?: string;
  source: InventoryItem['source'];
  provenance: ProvenanceEntry[];
}

export interface InventoryQuery {
  kind: string;
  region: string;
  routeKey?: string;
  /** Minimum confidence to include; defaults to 0.3. */
  minConfidence?: number;
  /** Maximum rows, ranked by confidence then recency; defaults to 10. */
  limit?: number;
}
