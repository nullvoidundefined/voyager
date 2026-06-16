import type { ChatNode, SSEEvent } from '@voyager/shared-types';
import type { Response } from 'express';

import {
  type CompletionTracker,
  type TripState,
  getFlowPosition,
} from 'app/prompts/bookingSteps/bookingSteps.js';
import type { TripContext } from 'app/prompts/tripContext/tripContext.js';
import type { TripWithDetails } from 'app/schemas/trips/trips.js';
import type { UserPreferences } from 'app/schemas/userPreferences/userPreferences.js';
import {
  EXPERIENCE_INTEREST_OPTIONS,
  type ExperienceInterest,
  type TripPlanCard,
} from 'app/types/planCard.js';

/** Map a TripWithDetails to the TripState shape needed by getFlowPosition. */
export function toFlowInput(trip: TripWithDetails): TripState {
  return {
    destination: trip.destination,
    origin: trip.origin ?? null,
    departure_date: trip.departure_date ?? null,
    return_date: trip.return_date ?? null,
    budget_total: trip.budget_total ?? null,
    transport_mode: trip.transport_mode ?? null,
    trip_type: trip.trip_type ?? undefined,
    flights: (trip.flights ?? []).map((f) => ({ id: f.id })),
    hotels: (trip.hotels ?? []).map((h) => ({ id: h.id })),
    car_rentals: (trip.car_rentals ?? []).map((c) => ({ id: c.id })),
    experiences: (trip.experiences ?? []).map((e) => ({ id: e.id })),
    status: trip.status ?? 'planning',
  };
}

/** Compute flow position from a trip, gating PLAN_TRIP on tracker.plan_confirmed. */
export function computeFlowPosition(
  trip: TripWithDetails,
  tracker?: CompletionTracker,
) {
  return getFlowPosition(toFlowInput(trip), tracker);
}

const VALID_CATEGORY_IDS = new Set([
  'flights',
  'hotels',
  'car_rental',
  'experiences',
]);

/**
 * Apply a user-confirmed TripPlanCard to the tracker.
 * Sets plan_confirmed=true, updates category statuses, and extracts
 * experience interests. Does not overwrite already-selected categories.
 */
export function applyPlanConfirmation(
  tracker: CompletionTracker,
  card: TripPlanCard,
): CompletionTracker {
  const updated = { ...tracker };

  for (const category of card.categories) {
    if (!VALID_CATEGORY_IDS.has(category.id)) continue;
    const id = category.id as keyof Pick<
      CompletionTracker,
      'flights' | 'hotels' | 'car_rental' | 'experiences'
    >;
    if (updated[id] === 'selected') continue;

    if (category.not_applicable) {
      updated[id] = 'not_applicable';
    } else if (!category.enabled) {
      updated[id] = 'skipped';
    } else {
      updated[id] = 'pending';
    }
  }

  const expCategory = card.categories.find((c) => c.id === 'experiences');
  const interestsOpt = expCategory?.sub_options?.find(
    (o) => o.id === 'interests',
  );
  if (interestsOpt?.type === 'multi') {
    // SEC-03: values flow verbatim into sub-agent system prompts on every
    // subsequent LLM turn. Restrict to the canonical allowlist so a
    // crafted plan card cannot inject prompts via this field.
    const validInterestIds = new Set<string>(
      EXPERIENCE_INTEREST_OPTIONS.map((o) => o.id),
    );
    updated.experience_interests = interestsOpt.values.filter(
      (v): v is ExperienceInterest =>
        typeof v === 'string' && validInterestIds.has(v),
    );
  }

  updated.plan_confirmed = true;
  return updated;
}

/** Flush SSE data through any proxy buffering. */
export function flushSSE(res: Response): void {
  (res as unknown as { flush?: () => void }).flush?.();
}

/** Create an SSE event emitter bound to a response. */
export function createSSEEmitter(res: Response): (event: SSEEvent) => void {
  return (event: SSEEvent) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    flushSSE(res);
  };
}

/** Build Claude message array from conversation history + current message, with truncation. */
export function buildClaudeMessages(
  history: Array<{ role: string; content: string | null }>,
  currentMessage: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const MAX_HISTORY_MESSAGES = 20;

  const messages = history
    .filter(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') &&
        m.content !== null &&
        m.content !== '',
    )
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content!,
    }));

  messages.push({ role: 'user', content: currentMessage });

  if (messages.length > MAX_HISTORY_MESSAGES + 1) {
    messages.splice(1, messages.length - MAX_HISTORY_MESSAGES - 1);
  }

  return messages;
}

/** Build the TripContext for the system prompt from trip details + user preferences. */
export function buildTripContext(
  trip: TripWithDetails,
  userPrefs: UserPreferences | null,
): TripContext {
  return {
    destination: trip.destination,
    origin: trip.origin ?? null,
    departure_date: trip.departure_date ?? null,
    return_date: trip.return_date ?? null,
    budget_total: trip.budget_total ?? 0,
    budget_currency: trip.budget_currency ?? 'USD',
    travelers: trip.travelers ?? 1,
    transport_mode: trip.transport_mode ?? null,
    trip_type: trip.trip_type ?? null,
    flexible_dates: trip.flexible_dates ?? false,
    preferences: {},
    user_preferences: userPrefs
      ? {
          accommodation: userPrefs.accommodation,
          travel_pace: userPrefs.travel_pace,
          dietary: userPrefs.dietary,
          dining_style: userPrefs.dining_style,
          activities: userPrefs.activities,
          travel_party: userPrefs.travel_party,
          budget_comfort: userPrefs.budget_comfort,
          lgbtq_safety: userPrefs.lgbtq_safety ?? false,
          gender: userPrefs.gender ?? null,
        }
      : undefined,
    selected_flights: (trip.flights ?? []).map((f) => ({
      airline: f.airline ?? '',
      flight_number: f.flight_number ?? '',
      price: f.price ?? 0,
      departure_time: f.departure_time ? f.departure_time.toISOString() : '',
      arrival_time: f.arrival_time ? f.arrival_time.toISOString() : '',
    })),
    selected_hotels: (trip.hotels ?? []).map((h) => ({
      name: h.name ?? '',
      price_per_night: h.price_per_night ?? 0,
      total_price: h.total_price ?? 0,
      star_rating: h.star_rating ?? 0,
    })),
    selected_car_rentals: (trip.car_rentals ?? []).map((c) => ({
      provider: c.provider,
      car_name: c.car_name,
      car_type: c.car_type,
      price_per_day: c.price_per_day,
      total_price: c.total_price,
    })),
    selected_experiences: (trip.experiences ?? []).map((e) => ({
      name: e.name ?? '',
      estimated_cost: e.estimated_cost ?? 0,
      category: e.category ?? '',
    })),
    total_spent:
      (trip.flights ?? []).reduce((sum, f) => sum + (f.price ?? 0), 0) +
      (trip.hotels ?? []).reduce((sum, h) => sum + (h.total_price ?? 0), 0) +
      (trip.car_rentals ?? []).reduce(
        (sum, c) => sum + (c.total_price ?? 0),
        0,
      ) +
      (trip.experiences ?? []).reduce(
        (sum, e) => sum + (e.estimated_cost ?? 0),
        0,
      ),
  };
}

interface MissingField {
  name: string;
  label: string;
  field_type: 'text' | 'date' | 'number' | 'select';
  required: boolean;
}

/** Build a travel_plan_form node for missing trip fields, or null if none are missing. */
export function buildMissingFieldsForm(trip: TripWithDetails): ChatNode | null {
  const isPlaceholder =
    !trip.destination ||
    trip.destination === 'Planning...' ||
    trip.destination === 'New trip';
  const missingFields: MissingField[] = [];

  if (isPlaceholder) {
    missingFields.push({
      name: 'destination',
      label: 'Where do you want to go?',
      field_type: 'text',
      required: true,
    });
  }
  if (!trip.origin) {
    missingFields.push({
      name: 'origin',
      label: 'Where are you traveling from?',
      field_type: 'text',
      required: true,
    });
  }
  if (!trip.departure_date) {
    missingFields.push({
      name: 'departure_date',
      label: 'Departure date',
      field_type: 'date',
      required: true,
    });
    // F-05: surface the Fixed/Flexible toggle alongside the date field
    // so the user can express flexibility while planning dates. The
    // toggle defaults to Fixed on the client when no value is supplied.
    missingFields.push({
      name: 'flexible_dates',
      label: 'Date flexibility',
      field_type: 'select',
      required: false,
    });
  }
  const isOneWay = trip.trip_type === 'one_way';
  if (!isOneWay && !trip.return_date) {
    missingFields.push({
      name: 'return_date',
      label: 'Return date',
      field_type: 'date',
      required: true,
    });
  }
  if (!trip.budget_total) {
    missingFields.push({
      name: 'budget',
      label: 'Total budget in USD (optional)',
      field_type: 'number',
      required: false,
    });
  }
  if (!trip.travelers || trip.travelers < 1) {
    missingFields.push({
      name: 'travelers',
      label: 'Number of travelers',
      field_type: 'number',
      required: true,
    });
  }

  if (missingFields.length === 0) return null;
  return { type: 'travel_plan_form', fields: missingFields };
}
