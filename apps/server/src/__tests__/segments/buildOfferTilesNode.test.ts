import type { OfferKind } from '@repo/types';
import { describe, expect, it } from 'vitest';

import { buildOfferTilesNode } from 'app/segments/buildOfferTilesNode.js';
import type { SegmentCapability } from 'app/segments/segmentCapability.js';

// Finding-3 regression guard: a synthetic capability (a mode nodeBuilder has
// never heard of) must produce offer tiles with ZERO edits outside registry
// data. If this test needs nodeBuilder changes to pass, the abstraction leaked.
const ferryCapability: SegmentCapability = {
  kind: 'flight', // narrowest existing kind; tileKind below is what renders
  label: 'Ferry',
  planCategoryId: 'flights',
  requiredTools: [],
  buildSearchKeys: () => ({ region: 'aegean' }),
  resultListKey: 'ferries',
  searchTool: 'search_ferries',
  selectTool: 'select_ferry',
  selectionKey: 'ferries',
  subAgentTools: [],
  tileKind: 'ferry' as OfferKind,
  toOffer: (item) => {
    const ferry = item as { name: string; price: number };
    return {
      id: ferry.name,
      title: ferry.name,
      price: ferry.price,
      currency: 'USD',
    };
  },
};

describe('buildOfferTilesNode', () => {
  it('builds offer tiles for any capability from registry data alone', () => {
    const node = buildOfferTilesNode(ferryCapability, {
      status: 'ok',
      ferries: [{ name: 'Blue Star', price: 42 }],
    });
    expect(node).toEqual({
      type: 'offer_tiles',
      offer_kind: 'ferry',
      offers: [
        { id: 'Blue Star', title: 'Blue Star', price: 42, currency: 'USD' },
      ],
      selectable: true,
    });
  });

  it('returns null for structured failures (timeout/quota/error)', () => {
    for (const status of ['timeout', 'quota_exhausted', 'error']) {
      expect(buildOfferTilesNode(ferryCapability, { status })).toBeNull();
    }
  });

  it('accepts bare-array results', () => {
    const node = buildOfferTilesNode(ferryCapability, [
      { name: 'Sea Cat', price: 15 },
    ]);
    expect(node?.type).toBe('offer_tiles');
    if (node?.type === 'offer_tiles') {
      expect(node.offers).toHaveLength(1);
    }
  });

  it('returns empty offers when the result has neither array nor named key', () => {
    const node = buildOfferTilesNode(ferryCapability, { unrelated: true });
    if (node?.type === 'offer_tiles') {
      expect(node.offers).toEqual([]);
    } else {
      throw new Error('expected offer_tiles node');
    }
  });
});
