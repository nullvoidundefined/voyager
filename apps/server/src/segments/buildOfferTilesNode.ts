/**
 * Builds a generic offer_tiles ChatNode from any segment capability and its
 * search tool's raw result. The single place search results become tiles: a
 * new mode reaches the client by registering resultListKey + toOffer, never
 * by adding a nodeBuilder switch arm.
 */
import type { ChatNode } from '@repo/types';

import { extractResultItems } from 'app/segments/extractResultItems.js';
import type { SegmentCapability } from 'app/segments/segmentCapability.js';

export function buildOfferTilesNode(
  capability: SegmentCapability,
  result: unknown,
): ChatNode | null {
  if (!shouldRenderTiles(result)) return null;
  const items = extractResultItems(result, capability.resultListKey);
  return {
    offer_kind: capability.tileKind,
    offers: items.map((item) => capability.toOffer(item)),
    selectable: true,
    type: 'offer_tiles',
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
