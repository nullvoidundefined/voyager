/**
 * Converts raw tool-result payloads into normalized ChatNode objects the
 * client can render. Search tools resolve through the segment-capability
 * registry to a generic offer_tiles node, so a new travel mode reaches the
 * client by registration, never by adding a switch arm here.
 */
import type { ChatNode } from '@repo/types';

import { buildOfferTilesNode } from 'app/segments/buildOfferTilesNode.js';
import { SEGMENT_CAPABILITIES } from 'app/segments/registry/index.js';
import type { SegmentCapability } from 'app/segments/segmentCapability.js';

function buildSearchToolIndex(): Record<string, SegmentCapability> {
  const index: Record<string, SegmentCapability> = {};
  for (const capability of Object.values(SEGMENT_CAPABILITIES)) {
    index[capability.searchTool] = capability;
  }
  return index;
}

const SEARCH_TOOL_CAPABILITIES = buildSearchToolIndex();

export function buildNodeFromToolResult(
  toolName: string,
  result: unknown,
): ChatNode | null {
  const capability = SEARCH_TOOL_CAPABILITIES[toolName];
  if (capability) {
    return buildOfferTilesNode(capability, result);
  }

  if (toolName === 'calculate_remaining_budget') {
    const data = result as Record<string, unknown>;
    return {
      type: 'budget_bar',
      allocated: (data.total_spent as number) ?? 0,
      total: (data.total_budget as number) ?? 0,
      currency: (data.currency as string) ?? 'USD',
    };
  }

  return null;
}
