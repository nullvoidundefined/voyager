import { describe, expect, it } from 'vitest';

import { getJourneyType } from 'app/journeys/registry.js';

describe('journey type registry', () => {
  it('flight_trip routes in legacy order with legacy plan-card order', () => {
    const journey = getJourneyType('flight_trip');
    expect(journey.segments.map((slot) => slot.kind)).toEqual([
      'flight',
      'hotel',
      'experience',
      'car_rental',
    ]);
    expect(journey.planCardOrder).toEqual([
      'flight',
      'hotel',
      'car_rental',
      'experience',
    ]);
  });

  it('flight_trip slot predicates preserve buildDefaultPlanCard semantics', () => {
    const journey = getJourneyType('flight_trip');
    const flightSlot = journey.segments.find((slot) => slot.kind === 'flight');
    const hotelSlot = journey.segments.find((slot) => slot.kind === 'hotel');
    const drivingTrip = {
      destination: 'Paris',
      origin: 'JFK',
      departure_date: '2026-06-01',
      return_date: '2026-06-10',
      budget_total: 5000,
      transport_mode: 'driving' as const,
      flights: [],
      hotels: [],
      experiences: [],
      status: 'planning',
    };
    expect(flightSlot?.notApplicableWhen?.(drivingTrip)).toBe('Driving trip');
    const dayTrip = {
      ...drivingTrip,
      transport_mode: 'flying' as const,
      return_date: '2026-06-01',
    };
    expect(flightSlot?.notApplicableWhen?.(dayTrip)).toBeUndefined();
    expect(hotelSlot?.notApplicableWhen?.(dayTrip)).toBe('Day trip');
  });
});
