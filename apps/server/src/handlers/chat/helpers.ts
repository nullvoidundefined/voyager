/**
 * Streaming helpers for the chat handlers: builds SSE events and tracks
 * completion state across a chat turn. Extracted from the handler so the
 * request/response plumbing stays separate from the incremental token logic.
 */
import type { ChatNode, SSEEvent } from '@repo/types';
import type { Response } from 'express';

import {
  type CompletionTracker,
  type TripState,
  getFlowPosition,
} from 'app/prompts/bookingSteps.js';
import type { TripContext } from 'app/prompts/tripContext.js';
import type { TripWithDetails } from 'app/schemas/trips.js';
import type { UserPreferences } from 'app/schemas/userPreferences.js';
import { getSegmentKindForPlanCategory } from 'app/segments/planCategoryIndex.js';
import {
  EXPERIENCE_INTEREST_OPTIONS,
  type ExperienceInterest,
  type TripPlanCard,
} from 'app/types/planCard.js';

/** Map a TripWithDetails to the TripState shape needed by getFlowPosition. */
export function toFlowInput(trip: TripWithDetails): TripState {
  return {
    budget_total: trip.budget_total ?? null,
    car_rentals: (trip.car_rentals ?? []).map((c) => ({ id: c.id })),
    departure_date: trip.departure_date ?? null,
    destination: trip.destination,
    experiences: (trip.experiences ?? []).map((e) => ({ id: e.id })),
    flights: (trip.flights ?? []).map((f) => ({ id: f.id })),
    hotels: (trip.hotels ?? []).map((h) => ({ id: h.id })),
    origin: trip.origin ?? null,
    return_date: trip.return_date ?? null,
    status: trip.status ?? 'planning',
    transport_mode: trip.transport_mode ?? null,
    trip_type: trip.trip_type ?? undefined,
  };
}

/** Compute flow position from a trip, gating PLAN_TRIP on tracker.plan_confirmed. */
export function computeFlowPosition(
  trip: TripWithDetails,
  tracker?: CompletionTracker,
) {
  return getFlowPosition(toFlowInput(trip), tracker);
}

/**
 * Apply a user-confirmed TripPlanCard to the tracker.
 * Sets plan_confirmed=true, updates segment statuses, and extracts
 * experience interests. Does not overwrite already-selected segments.
 * Card category ids are legacy plural wire values, bridged to SegmentKind.
 */
export function applyPlanConfirmation(
  tracker: CompletionTracker,
  card: TripPlanCard,
): CompletionTracker {
  const updated = { ...tracker, segments: { ...tracker.segments } };

  for (const category of card.categories) {
    const kind = getSegmentKindForPlanCategory(category.id);
    if (kind === undefined) continue;
    if (updated.segments[kind] === 'selected') continue;

    if (category.not_applicable) {
      updated.segments[kind] = 'not_applicable';
    } else if (!category.enabled) {
      updated.segments[kind] = 'skipped';
    } else {
      updated.segments[kind] = 'pending';
    }
  }

  const interests = extractExperienceInterests(card);
  if (interests !== null) {
    updated.segment_interests = {
      ...updated.segment_interests,
      experience: interests,
    };
  }

  updated.plan_confirmed = true;
  return updated;
}

/** Extracts allowlisted experience interests from a plan card, or null when absent. */
function extractExperienceInterests(
  card: TripPlanCard,
): ExperienceInterest[] | null {
  const expCategory = card.categories.find((c) => c.id === 'experiences');
  const interestsOpt = expCategory?.sub_options?.find(
    (o) => o.id === 'interests',
  );
  if (interestsOpt?.type !== 'multi') return null;
  // SEC-03: values flow verbatim into sub-agent system prompts on every
  // subsequent LLM turn. Restrict to the canonical allowlist so a
  // crafted plan card cannot inject prompts via this field.
  const validInterestIds = new Set<string>(
    EXPERIENCE_INTEREST_OPTIONS.map((o) => o.id),
  );
  return interestsOpt.values.filter(
    (v): v is ExperienceInterest =>
      typeof v === 'string' && validInterestIds.has(v),
  );
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
      content: m.content!,
      role: m.role as 'user' | 'assistant',
    }));

  messages.push({ content: currentMessage, role: 'user' });

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
    budget_currency: trip.budget_currency ?? 'USD',
    budget_total: trip.budget_total ?? 0,
    departure_date: trip.departure_date ?? null,
    destination: trip.destination,
    flexible_dates: trip.flexible_dates ?? false,
    origin: trip.origin ?? null,
    preferences: {},
    return_date: trip.return_date ?? null,
    selected_car_rentals: (trip.car_rentals ?? []).map((c) => ({
      car_name: c.car_name,
      car_type: c.car_type,
      price_per_day: c.price_per_day,
      provider: c.provider,
      total_price: c.total_price,
    })),
    selected_experiences: (trip.experiences ?? []).map((e) => ({
      category: e.category ?? '',
      estimated_cost: e.estimated_cost ?? 0,
      name: e.name ?? '',
    })),
    selected_flights: (trip.flights ?? []).map((f) => ({
      airline: f.airline ?? '',
      arrival_time: f.arrival_time ? f.arrival_time.toISOString() : '',
      departure_time: f.departure_time ? f.departure_time.toISOString() : '',
      flight_number: f.flight_number ?? '',
      price: f.price ?? 0,
    })),
    selected_hotels: (trip.hotels ?? []).map((h) => ({
      name: h.name ?? '',
      price_per_night: h.price_per_night ?? 0,
      star_rating: h.star_rating ?? 0,
      total_price: h.total_price ?? 0,
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
    transport_mode: trip.transport_mode ?? null,
    travelers: trip.travelers ?? 1,
    trip_type: trip.trip_type ?? null,
    user_preferences: userPrefs
      ? {
          accommodation: userPrefs.accommodation,
          activities: userPrefs.activities,
          budget_comfort: userPrefs.budget_comfort,
          dietary: userPrefs.dietary,
          dining_style: userPrefs.dining_style,
          gender: userPrefs.gender ?? null,
          lgbtq_safety: userPrefs.lgbtq_safety ?? false,
          travel_pace: userPrefs.travel_pace,
          travel_party: userPrefs.travel_party,
        }
      : undefined,
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
      field_type: 'text',
      label: 'Where do you want to go?',
      name: 'destination',
      required: true,
    });
  }
  if (!trip.origin) {
    missingFields.push({
      field_type: 'text',
      label: 'Where are you traveling from?',
      name: 'origin',
      required: true,
    });
  }
  if (!trip.departure_date) {
    missingFields.push({
      field_type: 'date',
      label: 'Departure date',
      name: 'departure_date',
      required: true,
    });
    // F-05: surface the Fixed/Flexible toggle alongside the date field
    // so the user can express flexibility while planning dates. The
    // toggle defaults to Fixed on the client when no value is supplied.
    missingFields.push({
      field_type: 'select',
      label: 'Date flexibility',
      name: 'flexible_dates',
      required: false,
    });
  }
  const isOneWay = trip.trip_type === 'one_way';
  if (!isOneWay && !trip.return_date) {
    missingFields.push({
      field_type: 'date',
      label: 'Return date',
      name: 'return_date',
      required: true,
    });
  }
  if (!trip.budget_total) {
    missingFields.push({
      field_type: 'number',
      label: 'Total budget in USD (optional)',
      name: 'budget',
      required: false,
    });
  }
  if (!trip.travelers || trip.travelers < 1) {
    missingFields.push({
      field_type: 'number',
      label: 'Number of travelers',
      name: 'travelers',
      required: true,
    });
  }

  if (missingFields.length === 0) return null;
  return { fields: missingFields, type: 'travel_plan_form' };
}
