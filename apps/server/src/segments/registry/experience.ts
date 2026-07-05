/** Experience segment capability: legacy experience sub-agent wiring as registry data. */
import type { SegmentCapability } from 'app/segments/segmentCapability.js';

export const experienceCapability: SegmentCapability = {
  kind: 'experience',
  label: 'Experiences',
  planCategoryId: 'experiences',
  // Routing unblocks experiences once flights resolve (legacy selectSubAgent
  // ladder), but the legacy presentation prose gates them on hotel selection;
  // both gates are preserved independently.
  presentationRequires: ['hotel'],
  requiredTools: [],
  requires: ['flight'],
  searchTool: 'search_experiences',
  selectTool: 'select_experience',
  selectionKey: 'experiences',
  subAgentTools: [
    'search_experiences',
    'select_experience',
    'calculate_remaining_budget',
    // ORC-01: daily schedule is built from confirmed experiences.
    'plan_daily_schedule',
    'format_response',
  ],
  tileKind: 'experience',
};
