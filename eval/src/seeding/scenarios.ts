/**
 * Trip scenarios for the eval seeder. Each scenario describes a trip to create
 * and a sequence of chat messages to send. Flying scenarios exercise the flight
 * sub-agent; driving scenarios (transport_mode: 'driving') skip flights and go
 * straight to hotels, since isResolved(flights) is true for not_applicable.
 */
import type { CreateTripParams, UpdateTripParams } from './apiClient.js';

export interface ChatTurn {
  message: string;
}

export interface TripScenario {
  name: string;
  trip: CreateTripParams;
  update?: UpdateTripParams;
  turns: ChatTurn[];
}

/** Departure 60 days out, return 7 days later. */
function futureDates(
  offsetDays: number,
  durationDays: number,
): { departure_date: string; return_date: string } {
  const departure = new Date();
  departure.setDate(departure.getDate() + offsetDays);
  const returnDate = new Date(departure);
  returnDate.setDate(returnDate.getDate() + durationDays);
  return {
    departure_date: departure.toISOString().slice(0, 10),
    return_date: returnDate.toISOString().slice(0, 10),
  };
}

export const SCENARIOS: TripScenario[] = [
  // --- Flying scenarios (exercise flight sub-agent) ---
  {
    name: 'NYC to Paris (flying, budget-aware)',
    trip: {
      destination: 'Paris, France',
      origin: 'New York, NY',
      budget_total: 3000,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(60, 7),
    },
    turns: [{ message: 'Find me flights to Paris.' }],
  },
  {
    name: 'LA to Tokyo (flying, solo traveler)',
    trip: {
      destination: 'Tokyo, Japan',
      origin: 'Los Angeles, CA',
      budget_total: 4000,
      budget_currency: 'USD',
      travelers: 1,
      ...futureDates(75, 10),
    },
    turns: [{ message: 'Search for flights to Tokyo.' }],
  },
  {
    name: 'Chicago to London (flying, family)',
    trip: {
      destination: 'London, UK',
      origin: 'Chicago, IL',
      budget_total: 8000,
      budget_currency: 'USD',
      travelers: 4,
      ...futureDates(90, 9),
    },
    turns: [{ message: 'What flights are available to London?' }],
  },
  {
    name: 'Miami to Cancun (flying, weekend)',
    trip: {
      destination: 'Cancun, Mexico',
      origin: 'Miami, FL',
      budget_total: 1500,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(30, 4),
    },
    turns: [{ message: 'Show me flights to Cancun.' }],
  },

  // --- Driving scenarios (transport_mode=driving, exercises hotel sub-agent) ---
  {
    name: 'Road trip to Nashville (driving, hotels)',
    trip: {
      destination: 'Nashville, TN',
      origin: 'Atlanta, GA',
      budget_total: 1200,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(45, 3),
    },
    update: { transport_mode: 'driving' },
    turns: [{ message: 'Find hotels in Nashville.' }],
  },
  {
    name: 'Drive to San Francisco (driving, hotels)',
    trip: {
      destination: 'San Francisco, CA',
      origin: 'Los Angeles, CA',
      budget_total: 2000,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(40, 5),
    },
    update: { transport_mode: 'driving' },
    turns: [{ message: 'What hotels are available?' }],
  },
  {
    name: 'Drive to New Orleans (driving, hotels)',
    trip: {
      destination: 'New Orleans, LA',
      origin: 'Houston, TX',
      budget_total: 1000,
      budget_currency: 'USD',
      travelers: 3,
      ...futureDates(50, 4),
    },
    update: { transport_mode: 'driving' },
    turns: [{ message: 'Search for hotels in New Orleans.' }],
  },
  {
    name: 'Drive to Sedona (driving, hotels)',
    trip: {
      destination: 'Sedona, AZ',
      origin: 'Phoenix, AZ',
      budget_total: 800,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(35, 3),
    },
    update: { transport_mode: 'driving' },
    turns: [{ message: 'Find me a hotel in Sedona.' }],
  },

  // --- Batch 2: more flying scenarios ---
  {
    name: 'Boston to Barcelona (flying, couple)',
    trip: {
      destination: 'Barcelona, Spain',
      origin: 'Boston, MA',
      budget_total: 5000,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(80, 8),
    },
    turns: [{ message: 'Find flights to Barcelona.' }],
  },
  {
    name: 'Seattle to Bali (flying, solo)',
    trip: {
      destination: 'Bali, Indonesia',
      origin: 'Seattle, WA',
      budget_total: 3500,
      budget_currency: 'USD',
      travelers: 1,
      ...futureDates(100, 14),
    },
    turns: [{ message: 'Search for flights to Bali.' }],
  },
  {
    name: 'Dallas to Rome (flying, anniversary)',
    trip: {
      destination: 'Rome, Italy',
      origin: 'Dallas, TX',
      budget_total: 6000,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(65, 10),
    },
    turns: [{ message: 'Show me flight options to Rome.' }],
  },
  {
    name: 'Denver to Reykjavik (flying, adventure)',
    trip: {
      destination: 'Reykjavik, Iceland',
      origin: 'Denver, CO',
      budget_total: 4500,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(55, 7),
    },
    turns: [{ message: 'Find flights to Iceland.' }],
  },

  // --- Batch 2: more driving/hotel scenarios ---
  {
    name: 'Drive to Savannah (driving, hotels)',
    trip: {
      destination: 'Savannah, GA',
      origin: 'Charlotte, NC',
      budget_total: 1500,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(42, 4),
    },
    update: { transport_mode: 'driving' },
    turns: [{ message: 'Find hotels in Savannah.' }],
  },
  {
    name: 'Drive to Portland (driving, hotels)',
    trip: {
      destination: 'Portland, OR',
      origin: 'Seattle, WA',
      budget_total: 900,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(28, 3),
    },
    update: { transport_mode: 'driving' },
    turns: [{ message: 'What hotels are available in Portland?' }],
  },
  {
    name: 'Drive to Austin (driving, hotels)',
    trip: {
      destination: 'Austin, TX',
      origin: 'San Antonio, TX',
      budget_total: 700,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(38, 2),
    },
    update: { transport_mode: 'driving' },
    turns: [{ message: 'Search hotels in Austin.' }],
  },
  {
    name: 'Drive to Charleston (driving, hotels)',
    trip: {
      destination: 'Charleston, SC',
      origin: 'Columbia, SC',
      budget_total: 600,
      budget_currency: 'USD',
      travelers: 2,
      ...futureDates(25, 2),
    },
    update: { transport_mode: 'driving' },
    turns: [{ message: 'Find me hotels in Charleston.' }],
  },
];
