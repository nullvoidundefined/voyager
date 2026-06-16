import { describe, expect, it } from 'vitest';

import {
  getTripWithDetails,
  insertTripFlight,
  insertTripHotel,
} from 'app/repositories/trips/trips.js';

import { seedTrip, seedUser } from '../helpers/seed.js';

describe('booking_url in trip selections', () => {
  it('is returned on hotel rows after insertion', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);

    await insertTripHotel(trip.id, {
      name: 'Test Hotel',
      city: 'Paris',
      price_per_night: 200,
      total_price: 1400,
      currency: 'USD',
      booking_url: 'https://booking.example.com/hotel/123',
    });

    const result = await getTripWithDetails(trip.id, user.id);
    expect(result?.hotels[0]).toHaveProperty(
      'booking_url',
      'https://booking.example.com/hotel/123',
    );
  });

  it('is returned on flight rows after insertion', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);

    await insertTripFlight(trip.id, {
      airline: 'Air Test',
      flight_number: 'AT001',
      origin: 'JFK',
      destination: 'CDG',
      price: 800,
      currency: 'USD',
      booking_url: 'https://booking.example.com/flight/456',
    });

    const result = await getTripWithDetails(trip.id, user.id);
    expect(result?.flights[0]).toHaveProperty(
      'booking_url',
      'https://booking.example.com/flight/456',
    );
  });

  it('returns null booking_url when not provided', async () => {
    const user = await seedUser();
    const trip = await seedTrip(user.id);

    await insertTripHotel(trip.id, {
      name: 'No URL Hotel',
      city: 'Rome',
      price_per_night: 150,
      total_price: 1050,
      currency: 'USD',
    });

    const result = await getTripWithDetails(trip.id, user.id);
    expect(result?.hotels[0]).toHaveProperty('booking_url', null);
  });
});
