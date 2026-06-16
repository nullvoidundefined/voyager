/**
 * Deterministic hotel fixtures spanning 1 to 5 stars for eval and E2E runs,
 * returned in place of a live SerpApi call so tests stay reproducible and
 * quota-free.
 */
import type { HotelSearchInput, HotelSearchOutcome } from '../hotelsTool.js';

export function generateMockHotels(
  input: HotelSearchInput,
): HotelSearchOutcome {
  const mockHotels = [
    {
      name: `${input.city} Backpacker Hostel`,
      stars: 1,
      pricePerNight: 25,
      landmark: 'Train Station',
    },
    {
      name: `${input.city} Budget Inn`,
      stars: 2,
      pricePerNight: 55,
      landmark: 'City Center',
    },
    {
      name: `${input.city} Central Hotel`,
      stars: 3,
      pricePerNight: 110,
      landmark: 'Old Town',
    },
    {
      name: `${input.city} Grand Hotel`,
      stars: 4,
      pricePerNight: 180,
      landmark: 'Main Square',
    },
    {
      name: `${input.city} Luxury Resort & Spa`,
      stars: 5,
      pricePerNight: 350,
      landmark: 'Waterfront',
    },
  ];
  const hotels = mockHotels.map((h, i) => ({
    hotel_id: `mock-hotel-${i}`,
    offer_id: `mock-hotel-offer-${i}`,
    name: h.name,
    address: `Near ${h.landmark}, ${input.city}`,
    city: input.city,
    star_rating: h.stars,
    price_per_night: h.pricePerNight,
    total_price: h.pricePerNight * 5,
    currency: 'USD',
    check_in: input.check_in,
    check_out: input.check_out,
    image_url: null,
    latitude: null,
    longitude: null,
  }));
  return { status: 'ok', hotels };
}
