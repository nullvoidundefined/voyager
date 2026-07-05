/** flight_trip journey: today's flight -> hotel -> experience -> car flow as data. */
import {
  EXPERIENCE_INTEREST_OPTIONS,
  FLIGHT_TRIP_TYPE_OPTIONS,
} from '@repo/types';

import type { JourneyType } from 'app/journeys/journeyType.js';

export const FLIGHT_TRIP: JourneyType = {
  id: 'flight_trip',
  inferenceHints: ['fly', 'flight', 'plane tickets'],
  label: 'Flight trip',
  planCardOrder: ['flight', 'hotel', 'car_rental', 'experience'],
  segments: [
    {
      buildSubOptions: (trip) => [
        {
          id: 'trip_type',
          label: 'Trip type',
          options: FLIGHT_TRIP_TYPE_OPTIONS,
          type: 'radio',
          value: trip.trip_type === 'one_way' ? 'one_way' : 'round_trip',
        },
      ],
      defaultEnabled: true,
      kind: 'flight',
      notApplicableWhen: (trip) =>
        trip.transport_mode === 'driving' ? 'Driving trip' : undefined,
      optional: false,
    },
    {
      defaultEnabled: true,
      kind: 'hotel',
      notApplicableWhen: (trip) =>
        trip.departure_date !== null &&
        trip.return_date !== null &&
        trip.departure_date === trip.return_date
          ? 'Day trip'
          : undefined,
      optional: true,
    },
    {
      buildSubOptions: () => [
        {
          id: 'interests',
          label: 'Interests',
          options: EXPERIENCE_INTEREST_OPTIONS,
          type: 'multi',
          values: [],
        },
      ],
      defaultEnabled: true,
      kind: 'experience',
      optional: true,
    },
    { defaultEnabled: false, kind: 'car_rental', optional: true },
  ],
};
