/**
 * Executor-facing segment search: derives the knowledge-base lookup keys from
 * the tool's validated params and runs the shared cold-to-warm path, returning
 * the legacy per-tool outcome shape the agent prompts document.
 */
import type { SegmentKind } from '@repo/types';

import { getSegmentCapability } from 'app/segments/registry/index.js';
import { runSegmentSearch } from 'app/segments/runSegmentSearch.js';

export async function searchSegment(
  kind: SegmentKind,
  params: Record<string, unknown>,
  fromApi: (params: Record<string, unknown>) => Promise<unknown>,
  requestId?: string,
): Promise<unknown> {
  const capability = getSegmentCapability(kind);
  const keys = capability.buildSearchKeys(params);
  const result = await runSegmentSearch(
    capability,
    {
      kind,
      region: keys.region,
      ...(keys.routeKey ? { routeKey: keys.routeKey } : {}),
      params,
      ...(requestId ? { requestId } : {}),
    },
    fromApi,
  );
  return result.outcome;
}
