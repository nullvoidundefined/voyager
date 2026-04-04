/**
 * Mock search responses for eval runs.
 * Sets environment variable to signal the server's search tools
 * to return mock data instead of calling SerpApi.
 */

export interface MockFlight {
  airline: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  price: number;
  currency: string;
  stops: number;
}

export interface MockHotel {
  name: string;
  star_rating: number;
  price_per_night: number;
  total_price: number;
  currency: string;
  address: string;
}

export function generateMockFlights(
  origin: string,
  destination: string,
  date: string,
): MockFlight[] {
  const airlines = ['Delta', 'United', 'American', 'JetBlue', 'Southwest'];
  return airlines.slice(0, 3).map((airline, i) => ({
    airline,
    flight_number: `${airline.slice(0, 2).toUpperCase()}${100 + i * 50}`,
    origin,
    destination,
    departure_time: `${date}T${8 + i * 4}:00:00`,
    arrival_time: `${date}T${14 + i * 4}:00:00`,
    price: 300 + i * 150,
    currency: 'USD',
    stops: i,
  }));
}

export function generateMockHotels(city: string): MockHotel[] {
  const hotels = [
    { name: `${city} Grand Hotel`, star: 4, price: 150 },
    { name: `${city} Budget Inn`, star: 2, price: 65 },
    { name: `${city} Boutique Suites`, star: 5, price: 320 },
    { name: `${city} Central Lodge`, star: 3, price: 95 },
    { name: `${city} Waterfront Resort`, star: 4, price: 210 },
  ];
  return hotels.map((h) => ({
    name: h.name,
    star_rating: h.star,
    price_per_night: h.price,
    total_price: h.price * 5,
    currency: 'USD',
    address: `123 Main St, ${city}`,
  }));
}

export function generateMockExperiences(city: string): Array<{
  name: string;
  category: string;
  estimated_cost: number;
  rating: number;
  description: string;
}> {
  return [
    {
      name: `${city} Walking Tour`,
      category: 'culture',
      estimated_cost: 25,
      rating: 4.5,
      description: 'Guided walking tour of historic district',
    },
    {
      name: `${city} Food Tour`,
      category: 'food-wine',
      estimated_cost: 65,
      rating: 4.8,
      description: 'Local cuisine tasting experience',
    },
    {
      name: `${city} Museum Pass`,
      category: 'culture',
      estimated_cost: 30,
      rating: 4.3,
      description: 'Access to top museums',
    },
    {
      name: `${city} Sunset Cruise`,
      category: 'romantic',
      estimated_cost: 85,
      rating: 4.6,
      description: 'Evening cruise with drinks',
    },
    {
      name: `${city} Adventure Park`,
      category: 'adventure',
      estimated_cost: 45,
      rating: 4.4,
      description: 'Outdoor adventure activities',
    },
  ];
}

export function generateMockCarRentals(city: string): Array<{
  provider: string;
  car_name: string;
  car_type: string;
  price_per_day: number;
  total_price: number;
}> {
  return [
    {
      provider: 'Hertz',
      car_name: 'Toyota Corolla',
      car_type: 'economy',
      price_per_day: 35,
      total_price: 175,
    },
    {
      provider: 'Enterprise',
      car_name: 'Honda CR-V',
      car_type: 'suv',
      price_per_day: 55,
      total_price: 275,
    },
    {
      provider: 'Avis',
      car_name: 'Ford Mustang',
      car_type: 'convertible',
      price_per_day: 75,
      total_price: 375,
    },
  ];
}
