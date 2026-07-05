/**
 * Builds a generic offer_tiles ChatNode from any segment capability and its
 * search tool's raw result. The single place search results become tiles: a
 * new mode reaches the client by registering resultListKey + toOffer, never
 * by adding a nodeBuilder switch arm.
 */
import type { ChatNode } from '@repo/types';

import type { SegmentCapability } from 'app/segments/segmentCapability.js';

export function buildOfferTilesNode(
  capability: SegmentCapability,
  result: unknown,
): ChatNode | null {
  if (!shouldRenderTiles(result)) return null;
  const items = extractItems(result, capability.resultListKey);
  return {
    type: 'offer_tiles',
    offer_kind: capability.tileKind,
    offers: items.map((item) => capability.toOffer(item)),
    selectable: true,
  };
}

// F-17: when the tool returned a structured failure (status: timeout,
// quota_exhausted, error), skip the empty tile render so the user only
// sees the agent's narration of the failure mode, not an empty card list.
function shouldRenderTiles(result: unknown): boolean {
  if (result == null || typeof result !== 'object') return true;
  const status = (result as { status?: unknown }).status;
  if (typeof status !== 'string') return true;
  return status === 'ok';
}

// Tool results may be arrays directly (e.g. search_flights returns Flight[])
// or objects with a named key (e.g. { flights: Flight[] }). Handle both.
function extractItems(result: unknown, key: string): unknown[] {
  if (Array.isArray(result)) return result;
  const data = result as Record<string, unknown>;
  if (Array.isArray(data[key])) return data[key] as unknown[];
  return [];
}
