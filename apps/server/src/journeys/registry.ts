/**
 * Journey type registry, exhaustively keyed by JourneyTypeId so appending an
 * id to JOURNEY_TYPE_IDS fails compilation until a definition is registered.
 */
import type { JourneyTypeId } from '@repo/types';

import { FLIGHT_TRIP } from 'app/journeys/definitions/flightTrip.js';
import type { JourneyType } from 'app/journeys/journeyType.js';

export const JOURNEY_TYPES: Record<JourneyTypeId, JourneyType> = {
  flight_trip: FLIGHT_TRIP,
};

export function getJourneyType(id: JourneyTypeId): JourneyType {
  return JOURNEY_TYPES[id];
}
