import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

// SEC-03 (2026-04-06 audit): allowlist for location-like fields.
// Accepts unicode letters / numbers / spaces and the punctuation
// legitimately used in place names (comma, period, hyphen,
// apostrophe, parentheses). Rejects shell metachars, HTML / XSS
// characters, URL-structure characters (?, #, /, =), control
// characters, and anything longer than 100 chars. Length cap is
// conservative: the longest real city name ("Krung Thep Maha
// Nakhon..." 168 chars) does not fit, but the world does not need
// Voyager to book trips to Bangkok's full ceremonial name.
const locationAllowlist = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[\p{L}\p{N} ,.\-'()]+$/u,
    'Must contain only letters, numbers, spaces, and common punctuation',
  );

export const searchFlightsSchema = z.object({
  origin: locationAllowlist,
  destination: locationAllowlist,
  departure_date: dateString,
  return_date: dateString.optional(),
  passengers: z.number().int().min(1),
  max_price: z.number().positive().optional(),
  cabin_class: z
    .enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'])
    .optional(),
  one_way: z.boolean().optional(),
  flexible_dates: z.boolean().optional(),
});

export const searchHotelsSchema = z.object({
  city: locationAllowlist,
  check_in: dateString,
  check_out: dateString,
  guests: z.number().int().min(1),
  star_rating_min: z.number().min(1).max(5).optional(),
  max_price_per_night: z.number().positive().optional(),
});

export const searchExperiencesSchema = z.object({
  location: locationAllowlist,
  categories: z.array(locationAllowlist).min(1),
  max_price_per_person: z.number().positive().optional(),
  limit: z.number().int().positive().optional(),
});

export const calculateBudgetSchema = z.object({
  total_budget: z.number(),
  flight_cost: z.number(),
  hotel_total_cost: z.number(),
  car_rental_cost: z.number().nonnegative(),
  experience_costs: z.array(z.number()),
});

export const getDestinationInfoSchema = z.object({
  city_name: locationAllowlist,
});

export const updateTripSchema = z.object({
  destination: locationAllowlist.optional(),
  origin: locationAllowlist.optional(),
  departure_date: dateString.optional(),
  return_date: dateString.optional(),
  budget_total: z.number().positive().optional(),
  travelers: z.number().int().positive().optional(),
  transport_mode: z.enum(['flying', 'driving']).optional(),
});

export const searchCarRentalsSchema = z.object({
  pickup_location: locationAllowlist,
  pickup_date: dateString,
  dropoff_date: dateString,
  dropoff_location: locationAllowlist.optional(),
  car_type: z.string().max(50).optional(),
});

export const selectFlightSchema = z.object({
  airline: locationAllowlist,
  flight_number: locationAllowlist,
  origin: locationAllowlist,
  destination: locationAllowlist,
  departure_time: z.string().optional(),
  arrival_time: z.string().optional(),
  price: z.coerce.number(),
  currency: z.string().min(1),
});

export const selectHotelSchema = z.object({
  name: locationAllowlist,
  city: locationAllowlist.optional(),
  star_rating: z.coerce.number().optional(),
  price_per_night: z.coerce.number(),
  total_price: z.coerce.number(),
  currency: z.string().min(1),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
});

export const selectCarRentalSchema = z.object({
  provider: locationAllowlist,
  car_name: locationAllowlist,
  car_type: z.string().optional(),
  price_per_day: z.coerce.number().optional(),
  total_price: z.coerce.number(),
  currency: z.string().min(1),
});

export const selectExperienceSchema = z.object({
  name: locationAllowlist,
  category: z.string().optional(),
  estimated_cost: z.coerce.number(),
  rating: z.coerce.number().optional(),
});

export const formatResponseSchema = z.object({
  text: z.string().min(1),
  citations: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        url: z.string().optional(),
        source_type: z.string().optional(),
      }),
    )
    .optional(),
  quick_replies: z.array(z.string()).optional(),
  advisory: z
    .object({
      severity: z.enum(['info', 'warning', 'critical']),
      title: z.string(),
      body: z.string(),
    })
    .optional(),
  skip_category: z
    .enum(['flights', 'hotels', 'car_rental', 'experiences'])
    .optional(),
  plan_card: z.unknown().optional(),
});

const scheduleItemSchema = z.object({
  time_of_day: z.enum(['morning', 'afternoon', 'evening']),
  title: z.string().min(1),
  description: z.string().optional(),
  item_type: z.enum(['activity', 'meal', 'transport', 'accommodation']),
  item_order: z.number().int().positive(),
  place_id: z.string().max(100).optional(),
  booking_url: z.string().optional(),
  price_usd: z.number().optional(),
});

const scheduleDaySchema = z.object({
  day_number: z.number(),
  day_date: dateString,
  items: z.array(scheduleItemSchema),
});

export const planDailyScheduleSchema = z.object({
  days: z.array(scheduleDaySchema),
});

export const addLegSchema = z.object({
  origin: locationAllowlist,
  destination: locationAllowlist,
  depart_date: dateString,
  leg_order: z.number().int().positive(),
});

export const removeLegSchema = z.object({
  leg_id: z.string().min(1),
});

export const reorderLegsSchema = z.object({
  ordered_leg_ids: z.array(z.string().min(1)).min(1),
});

export const reOpenCategorySchema = z.object({
  category: z.enum(['flights', 'hotels', 'car_rental', 'experiences']),
});

export const toolSchemas: Record<string, z.ZodSchema> = {
  add_leg: addLegSchema,
  calculate_remaining_budget: calculateBudgetSchema,
  format_response: formatResponseSchema,
  get_destination_info: getDestinationInfoSchema,
  plan_daily_schedule: planDailyScheduleSchema,
  re_open_category: reOpenCategorySchema,
  remove_leg: removeLegSchema,
  reorder_legs: reorderLegsSchema,
  search_car_rentals: searchCarRentalsSchema,
  search_experiences: searchExperiencesSchema,
  search_flights: searchFlightsSchema,
  search_hotels: searchHotelsSchema,
  select_car_rental: selectCarRentalSchema,
  select_experience: selectExperienceSchema,
  select_flight: selectFlightSchema,
  select_hotel: selectHotelSchema,
  update_trip: updateTripSchema,
};
