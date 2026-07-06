/**
 * Tool partitions for the three core (non-segment) sub-agents; segment
 * partitions live on their capabilities in the segment registry.
 */
import type { SegmentKind } from '@repo/types';

import type { SubAgentType } from 'app/services/agent/subAgentTypes.js';

export const CORE_SUB_AGENT_TOOLS: Record<
  Exclude<SubAgentType, SegmentKind>,
  string[]
> = {
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
  detail: ['update_trip', 'get_destination_info', 'format_response'],
  plan: ['update_trip', 'format_response'],
};
