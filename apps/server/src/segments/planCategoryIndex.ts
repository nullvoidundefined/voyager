/**
 * Bridges legacy plural wire values to SegmentKind. skip_category,
 * re_open_category, and plan-card category ids all carry TripPlanCategoryId
 * values ('flights', 'hotels', ...); tracker segments are keyed by the
 * singular SegmentKind. The wire values are immutable legacy contract.
 */
import { SEGMENT_KINDS, type SegmentKind } from '@repo/types';

import { getSegmentCapability } from 'app/segments/registry/index.js';

function buildPlanCategoryIndex(): Record<string, SegmentKind> {
  const index: Record<string, SegmentKind> = {};
  for (const kind of SEGMENT_KINDS) {
    index[getSegmentCapability(kind).planCategoryId] = kind;
  }
  return index;
}

const PLAN_CATEGORY_TO_SEGMENT = buildPlanCategoryIndex();

export function getSegmentKindForPlanCategory(
  planCategoryId: string,
): SegmentKind | undefined {
  return PLAN_CATEGORY_TO_SEGMENT[planCategoryId];
}
