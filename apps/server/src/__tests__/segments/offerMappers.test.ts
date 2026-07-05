import { describe, expect, it } from 'vitest';

import { carRentalToOffer } from 'app/segments/offerMappers/carRentalToOffer.js';
import { experienceToOffer } from 'app/segments/offerMappers/experienceToOffer.js';
import { flightToOffer } from 'app/segments/offerMappers/flightToOffer.js';
import { hotelToOffer } from 'app/segments/offerMappers/hotelToOffer.js';

describe('flightToOffer', () => {
  it('maps a flight preserving every select_flight wire field in detail', () => {
    const offer = flightToOffer({
      id: 'f1',
      airline: 'JetBlue',
      airline_logo: 'https://logo.example/b6.png',
      flight_number: 'B6 75',
      origin: 'JFK',
      destination: 'CDG',
      departure_time: '2026-08-01T18:30:00Z',
      arrival_time: '2026-08-02T07:45:00Z',
      price: 512,
      currency: 'USD',
      cabin_class: 'ECONOMY',
    });
    expect(offer).toEqual({
      id: 'f1',
      title: 'JetBlue B6 75',
      subtitle: 'JFK to CDG',
      selection_label: 'JetBlue B6 75 - JFK to CDG',
      image_url: 'https://logo.example/b6.png',
      price: 512,
      currency: 'USD',
      price_unit: 'per_person',
      badges: ['ECONOMY'],
      detail: {
        airline: 'JetBlue',
        flight_number: 'B6 75',
        origin: 'JFK',
        destination: 'CDG',
        departure_time: '2026-08-01T18:30:00Z',
        arrival_time: '2026-08-02T07:45:00Z',
        cabin_class: 'ECONOMY',
      },
    });
  });

  it('generates an id when the raw item has none', () => {
    const offer = flightToOffer({
      airline: 'Delta',
      flight_number: 'DL1',
      origin: 'JFK',
      destination: 'LAX',
      departure_time: '2026-05-01T08:00:00',
      price: 300,
      currency: 'USD',
    });
    expect(offer.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(offer.badges).toEqual([]);
    expect(offer.detail).not.toHaveProperty('arrival_time');
  });
});

describe('hotelToOffer', () => {
  it('maps a hotel with legacy selection label and total price', () => {
    const offer = hotelToOffer({
      id: 'h1',
      name: 'Tokyo Grand',
      city: 'Tokyo',
      image_url: 'https://img.example/h.jpg',
      star_rating: 4,
      price_per_night: 120,
      total_price: 840,
      currency: 'USD',
      check_in: '2026-05-01',
      check_out: '2026-05-08',
      latitude: 35.6,
      longitude: 139.7,
    });
    expect(offer).toEqual({
      id: 'h1',
      title: 'Tokyo Grand',
      subtitle: 'Tokyo',
      selection_label: 'Tokyo Grand, Tokyo',
      image_url: 'https://img.example/h.jpg',
      price: 840,
      currency: 'USD',
      price_unit: 'total',
      badges: ['4-star'],
      detail: {
        name: 'Tokyo Grand',
        city: 'Tokyo',
        star_rating: 4,
        price_per_night: 120,
        total_price: 840,
        check_in: '2026-05-01',
        check_out: '2026-05-08',
      },
      lat: 35.6,
      lon: 139.7,
    });
  });

  it('defaults missing prices to zero and supports lat/lon field names', () => {
    const offer = hotelToOffer({
      name: 'Cheap Hotel',
      currency: 'USD',
      lat: 48.8,
      lon: 2.3,
    });
    expect(offer.price).toBe(0);
    expect(offer.detail).toMatchObject({
      price_per_night: 0,
      total_price: 0,
    });
    expect(offer.lat).toBe(48.8);
    expect(offer.lon).toBe(2.3);
  });
});

describe('carRentalToOffer', () => {
  it('maps a rental with features as badges and legacy selection label', () => {
    const offer = carRentalToOffer({
      id: 'c1',
      provider: 'Hertz',
      car_name: 'Toyota Corolla',
      car_type: 'compact',
      price_per_day: 45,
      total_price: 315,
      currency: 'USD',
      pickup_location: 'NRT Airport',
      dropoff_location: 'NRT Airport',
      pickup_date: '2026-05-01',
      dropoff_date: '2026-05-08',
      features: ['Automatic', 'AC'],
      image_url: 'https://img.example/c.jpg',
    });
    expect(offer).toEqual({
      id: 'c1',
      title: 'Toyota Corolla',
      subtitle: 'Hertz',
      selection_label: 'Toyota Corolla (Hertz)',
      image_url: 'https://img.example/c.jpg',
      price: 315,
      currency: 'USD',
      price_unit: 'total',
      badges: ['Automatic', 'AC'],
      detail: {
        provider: 'Hertz',
        car_name: 'Toyota Corolla',
        car_type: 'compact',
        price_per_day: 45,
        total_price: 315,
        pickup_location: 'NRT Airport',
        dropoff_location: 'NRT Airport',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
      },
    });
  });

  it('defaults missing features to an empty badge list', () => {
    const offer = carRentalToOffer({
      provider: 'Avis',
      car_name: 'Civic',
      car_type: 'compact',
      price_per_day: 40,
      total_price: 200,
      currency: 'USD',
    });
    expect(offer.badges).toEqual([]);
  });
});

describe('experienceToOffer', () => {
  it('maps an experience with photo_ref in detail for the client card', () => {
    const offer = experienceToOffer({
      id: 'e1',
      name: 'Senso-ji Temple',
      category: 'Temple',
      photo_ref: 'ph1',
      rating: 4.6,
      estimated_cost: 0,
      lat: 35.7,
      lon: 139.8,
    });
    expect(offer).toEqual({
      id: 'e1',
      title: 'Senso-ji Temple',
      subtitle: 'Temple',
      selection_label: 'Senso-ji Temple',
      price: 0,
      currency: 'USD',
      price_unit: 'per_person',
      badges: [],
      detail: {
        name: 'Senso-ji Temple',
        category: 'Temple',
        estimated_cost: 0,
        rating: 4.6,
        photo_ref: 'ph1',
      },
      lat: 35.7,
      lon: 139.8,
    });
  });
});
