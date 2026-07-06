/**
 * Routes booking flow state to the sub-agent that should handle the turn:
 * fixed phases map to the core agents, and the PLANNING phase walks the
 * journey's segments in order for the first unresolved, unblocked slot.
 */
import { getJourneyType } from 'app/journeys/registry.js';
import type {
  CompletionTracker,
  FlowPosition,
} from 'app/prompts/bookingSteps.js';
import {
  getSegmentStatus,
  isResolved,
  needsWork,
} from 'app/prompts/bookingSteps.js';
import { getSegmentCapability } from 'app/segments/registry/index.js';
import type { SubAgentType } from 'app/services/agent/subAgentTypes.js';

export function selectSubAgent(
  flowPosition: FlowPosition,
  tracker: CompletionTracker,
): SubAgentType {
  if (flowPosition.phase === 'COLLECT_DETAILS') return 'detail';
  if (flowPosition.phase === 'DISCOVER') return 'discover';
  if (flowPosition.phase === 'PLAN_TRIP') return 'plan';
  if (flowPosition.phase === 'COMPLETE') return 'conversation';

  // PLANNING phase: first segment in journey order that needs work and whose
  // routing dependencies are all resolved.
  for (const slot of getJourneyType(tracker.journeyType).segments) {
    if (!needsWork(getSegmentStatus(tracker, slot.kind))) continue;
    const blocked = (getSegmentCapability(slot.kind).requires ?? []).some(
      (dependency) => !isResolved(getSegmentStatus(tracker, dependency)),
    );
    if (!blocked) return slot.kind;
  }
  return 'conversation';
}
