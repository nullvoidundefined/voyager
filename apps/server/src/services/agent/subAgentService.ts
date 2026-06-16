/**
 * Defines the sub-agent types (detail, etc.) and the logic for routing booking
 * flow state to the appropriate specialized sub-agent. Exists to break the main
 * agent's work into focused sub-tasks driven by trip and booking-step state.
 */
import type { CompletionTracker } from 'app/prompts/bookingSteps.js';
import type { FlowPosition } from 'app/prompts/bookingSteps.js';
import type { TripState } from 'app/prompts/bookingSteps.js';
import { isResolved, needsWork } from 'app/prompts/bookingSteps.js';
import {
  EXPERIENCE_INTEREST_OPTIONS,
  FLIGHT_TRIP_TYPE_OPTIONS,
  type TripPlanCard,
} from 'app/types/planCard.js';

export type SubAgentType =
  | 'detail'
  | 'plan'
  | 'flight'
  | 'hotel'
  | 'ground'
  | 'experience'
  | 'conversation';

/** Tools that must be called before format_response for each sub-agent type.
 *  Consumed by AgentOrchestrator to enforce the data-before-response invariant
 *  in code rather than relying solely on prompt instructions. */
export const SUB_AGENT_REQUIRED_TOOLS: Record<SubAgentType, string[]> = {
  detail: [],
  plan: [],
  flight: ['search_flights'],
  hotel: ['search_hotels'],
  ground: [],
  experience: [],
  conversation: [],
};

export const SUB_AGENT_TOOLS: Record<SubAgentType, string[]> = {
  detail: ['update_trip', 'get_destination_info', 'format_response'],
  plan: ['update_trip', 'format_response'],
  flight: [
    'search_flights',
    'get_destination_info',
    'select_flight',
    'calculate_remaining_budget',
    // SEC-01-adjacent + ORC-01: legs are flight segments, so the flight
    // sub-agent needs to add/remove/reorder them during multi-city planning.
    'add_leg',
    'remove_leg',
    'reorder_legs',
    'format_response',
  ],
  hotel: [
    'search_hotels',
    'get_destination_info',
    'select_hotel',
    'calculate_remaining_budget',
    'format_response',
  ],
  ground: [
    'search_car_rentals',
    'select_car_rental',
    'calculate_remaining_budget',
    'format_response',
  ],
  experience: [
    'search_experiences',
    'select_experience',
    'calculate_remaining_budget',
    // ORC-01: daily schedule is built from confirmed experiences.
    'plan_daily_schedule',
    'format_response',
  ],
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

export function selectSubAgent(
  flowPosition: FlowPosition,
  tracker: CompletionTracker,
): SubAgentType {
  if (flowPosition.phase === 'COLLECT_DETAILS') return 'detail';
  if (flowPosition.phase === 'PLAN_TRIP') return 'plan';
  if (flowPosition.phase === 'COMPLETE') return 'conversation';

  // PLANNING phase -- route by tracker state
  if (needsWork(tracker.flights)) return 'flight';
  if (needsWork(tracker.hotels) && isResolved(tracker.flights)) return 'hotel';
  if (needsWork(tracker.experiences) && isResolved(tracker.flights))
    return 'experience';
  if (needsWork(tracker.car_rental) && isResolved(tracker.hotels))
    return 'ground';

  return 'conversation';
}

/**
 * Builds a TripPlanCard with deterministic defaults from trip state.
 * PlanAgent LLM receives this as a starting point and can adjust based
 * on conversation context before emitting the card to the user.
 */
export function buildDefaultPlanCard(trip: TripState): TripPlanCard {
  const flightsNotApplicable = trip.transport_mode === 'driving';
  const flightsNotApplicableReason = flightsNotApplicable
    ? 'Driving trip'
    : undefined;

  const isDayTrip =
    trip.departure_date !== null &&
    trip.return_date !== null &&
    trip.departure_date === trip.return_date;
  const hotelsNotApplicable = isDayTrip;
  const hotelsNotApplicableReason = isDayTrip ? 'Day trip' : undefined;

  const defaultTripType =
    trip.trip_type === 'one_way' ? 'one_way' : 'round_trip';

  return {
    categories: [
      {
        id: 'flights',
        label: 'Flight',
        enabled: !flightsNotApplicable,
        not_applicable: flightsNotApplicable,
        not_applicable_reason: flightsNotApplicableReason,
        sub_options: [
          {
            type: 'radio',
            id: 'trip_type',
            label: 'Trip type',
            options: FLIGHT_TRIP_TYPE_OPTIONS,
            value: defaultTripType,
          },
        ],
      },
      {
        id: 'hotels',
        label: 'Hotel',
        enabled: !hotelsNotApplicable,
        not_applicable: hotelsNotApplicable,
        not_applicable_reason: hotelsNotApplicableReason,
      },
      {
        id: 'car_rental',
        label: 'Car rental',
        enabled: false,
        not_applicable: false,
      },
      {
        id: 'experiences',
        label: 'Experiences',
        enabled: true,
        not_applicable: false,
        sub_options: [
          {
            type: 'multi',
            id: 'interests',
            label: 'Interests',
            options: EXPERIENCE_INTEREST_OPTIONS,
            values: [],
          },
        ],
      },
    ],
  };
}
