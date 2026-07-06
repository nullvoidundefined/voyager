/**
 * Builds a TripPlanCard with deterministic defaults from trip state, one row
 * per journey segment in the journey's plan-card order. PlanAgent LLM receives
 * this as a starting point and can adjust based on conversation context before
 * emitting the card to the user.
 */
import type { SegmentSlot } from 'app/journeys/journeyType.js';
import { getJourneyType } from 'app/journeys/registry.js';
import type { TripState } from 'app/prompts/bookingSteps.js';
import { getSegmentCapability } from 'app/segments/registry/index.js';
import type { TripPlanCard, TripPlanCategory } from 'app/types/planCard.js';

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
    enabled: notApplicableReason ? false : slot.defaultEnabled,
    id: capability.planCategoryId,
    label: capability.label,
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
