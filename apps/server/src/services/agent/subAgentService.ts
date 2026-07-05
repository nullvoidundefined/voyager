/**
 * Defines the sub-agent types and the logic for routing booking flow state to
 * the appropriate specialized sub-agent. Segment sub-agents are the SegmentKind
 * values themselves; their tool partitions and plan-card rows derive from the
 * segment-capability and journey-type registries.
 */
import type { SegmentKind } from '@repo/types';

import type { SegmentSlot } from 'app/journeys/journeyType.js';
import { getJourneyType } from 'app/journeys/registry.js';
import type { CompletionTracker } from 'app/prompts/bookingSteps.js';
import type { FlowPosition } from 'app/prompts/bookingSteps.js';
import type { TripState } from 'app/prompts/bookingSteps.js';
import {
  getSegmentStatus,
  isResolved,
  needsWork,
} from 'app/prompts/bookingSteps.js';
import { getSegmentCapability } from 'app/segments/registry/index.js';
import type { TripPlanCard, TripPlanCategory } from 'app/types/planCard.js';

export type SubAgentType = 'detail' | 'plan' | 'conversation' | SegmentKind;

type CoreSubAgentType = 'detail' | 'plan' | 'conversation';

const CORE_SUB_AGENT_TOOLS: Record<CoreSubAgentType, string[]> = {
  detail: ['update_trip', 'get_destination_info', 'format_response'],
  plan: ['update_trip', 'format_response'],
  conversation: [
    'update_trip',
    'get_destination_info',
    'calculate_remaining_budget',
    're_open_category',
    // ORC-01: post-PLANNING edits to legs and schedule must remain
    // reachable via chat after the booking flow ends.
    'add_leg',
    'remove_leg',
    'reorder_legs',
    'plan_daily_schedule',
    'format_response',
  ],
};

function isCoreSubAgent(subAgent: SubAgentType): subAgent is CoreSubAgentType {
  return (
    subAgent === 'detail' || subAgent === 'plan' || subAgent === 'conversation'
  );
}

/** Tool partition for a sub-agent turn; segment partitions live on the capability. */
export function getSubAgentTools(subAgent: SubAgentType): string[] {
  if (isCoreSubAgent(subAgent)) return CORE_SUB_AGENT_TOOLS[subAgent];
  return getSegmentCapability(subAgent).subAgentTools;
}

/** Tools that must be called before format_response for a sub-agent turn.
 *  Consumed by AgentOrchestrator to enforce the data-before-response invariant
 *  in code rather than relying solely on prompt instructions. */
export function getSubAgentRequiredTools(subAgent: SubAgentType): string[] {
  if (isCoreSubAgent(subAgent)) return [];
  return getSegmentCapability(subAgent).requiredTools;
}

export function selectSubAgent(
  flowPosition: FlowPosition,
  tracker: CompletionTracker,
): SubAgentType {
  if (flowPosition.phase === 'COLLECT_DETAILS') return 'detail';
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

/**
 * Builds a TripPlanCard with deterministic defaults from trip state, one row
 * per journey segment in the journey's plan-card order. PlanAgent LLM receives
 * this as a starting point and can adjust based on conversation context before
 * emitting the card to the user.
 */
export function buildDefaultPlanCard(trip: TripState): TripPlanCard {
  const journey = getJourneyType('flight_trip');
  const order =
    journey.planCardOrder ?? journey.segments.map((slot) => slot.kind);
  return {
    categories: order.map((kind) => {
      const slot = journey.segments.find((s) => s.kind === kind);
      if (!slot) {
        throw new Error(`planCardOrder kind not in journey segments: ${kind}`);
      }
      return buildPlanCategory(slot, trip);
    }),
  };
}

function buildPlanCategory(
  slot: SegmentSlot,
  trip: TripState,
): TripPlanCategory {
  const capability = getSegmentCapability(slot.kind);
  const notApplicableReason = slot.notApplicableWhen?.(trip);
  const category: TripPlanCategory = {
    id: capability.planCategoryId,
    label: capability.label,
    enabled: notApplicableReason ? false : slot.defaultEnabled,
    not_applicable: Boolean(notApplicableReason),
  };
  if (notApplicableReason) {
    category.not_applicable_reason = notApplicableReason;
  }
  if (slot.buildSubOptions) {
    category.sub_options = slot.buildSubOptions(trip);
  }
  return category;
}
