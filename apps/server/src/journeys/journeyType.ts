/**
 * Journey type descriptor: the ordered segment flow that used to be hardcoded
 * in selectSubAgent's if-ladder and the STRICT Presentation Order prose.
 */
import type {
  JourneyTypeId,
  SegmentKind,
  TripPlanSubOption,
} from '@repo/types';

import type { TripState } from 'app/prompts/bookingSteps.js';

export interface JourneyType {
  id: JourneyTypeId;
  label: string;
  /** Ordered segments; order drives routing and presentation. */
  segments: SegmentSlot[];
  /** Plan-card row order when it differs from routing order (legacy parity). */
  planCardOrder?: SegmentKind[];
  /** Natural-language cues for conversational inference (Phase 5). */
  inferenceHints: string[];
}

export interface SegmentSlot {
  kind: SegmentKind;
  defaultEnabled: boolean;
  optional: boolean;
  notApplicableWhen?: (trip: TripState) => string | undefined;
  buildSubOptions?: (trip: TripState) => TripPlanSubOption[];
}
