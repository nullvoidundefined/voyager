/**
 * Zod request schemas for trip create and update endpoints. Validates and
 * bounds untrusted trip input at the edge so handlers receive well-formed data.
 */
import { z } from 'zod';

export const createTripSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  origin: z.string().optional(),
  departure_date: z.string().optional(),
  return_date: z.string().optional(),
  budget_total: z.number().positive().optional(),
  budget_currency: z.string().default('USD'),
  travelers: z.number().int().positive().default(1),
  preferences: z
    .object({
      style: z.enum(['luxury', 'budget', 'mid-range']).optional(),
      pace: z.enum(['relaxed', 'moderate', 'packed']).optional(),
      interests: z.array(z.string()).optional(),
    })
    .default({}),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const updateTripSchema = z
  .object({
    destination: z.string().min(1).optional(),
    origin: z.string().optional(),
    departure_date: z.string().optional(),
    return_date: z.string().optional(),
    budget_total: z.number().positive().optional(),
    travelers: z.number().int().positive().optional(),
    transport_mode: z.enum(['flying', 'driving']).optional(),
    trip_type: z.enum(['round_trip', 'one_way']).optional(),
    flexible_dates: z.boolean().optional(),
    status: z.enum(['planning', 'saved', 'archived']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateTripInput = z.infer<typeof updateTripSchema>;

export interface Trip {
  id: string;
  user_id: string;
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  budget_currency: string;
  travelers: number;
  preferences: Record<string, unknown>;
  status: 'planning' | 'saved' | 'archived';
  transport_mode: 'flying' | 'driving' | null;
  trip_type: 'round_trip' | 'one_way' | null;
  flexible_dates: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TripFlight {
  id: string;
  trip_id: string;
  origin: string;
  destination: string;
  departure_time: Date | null;
  arrival_time: Date | null;
  airline: string | null;
  flight_number: string | null;
  price: number | null;
  currency: string;
  cabin_class: string | null;
  data_json: Record<string, unknown> | null;
  selected: boolean;
  created_at: Date;
}

export interface TripHotel {
  id: string;
  trip_id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  star_rating: number | null;
  price_per_night: number | null;
  total_price: number | null;
  currency: string;
  check_in: string | null;
  check_out: string | null;
  data_json: Record<string, unknown> | null;
  selected: boolean;
  created_at: Date;
}

export interface TripExperience {
  id: string;
  trip_id: string;
  google_place_id: string | null;
  name: string | null;
  category: string | null;
  address: string | null;
  rating: number | null;
  price_level: number | null;
  estimated_cost: number | null;
  data_json: Record<string, unknown> | null;
  selected: boolean;
  created_at: Date;
}

export interface TripCarRental {
  id: string;
  trip_id: string;
  provider: string;
  car_name: string;
  car_type: string;
  price_per_day: number;
  total_price: number;
  currency: string;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_date: string | null;
  dropoff_date: string | null;
  features: string[];
  image_url: string | null;
  data_json: Record<string, unknown> | null;
  selected: boolean;
  created_at: Date;
}

export interface TripWithDetails extends Trip {
  flights: TripFlight[];
  hotels: TripHotel[];
  car_rentals: TripCarRental[];
  experiences: TripExperience[];
}
