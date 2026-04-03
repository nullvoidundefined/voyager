export type BookingStep =
  | 'COLLECT_DETAILS'
  | 'TRANSPORT'
  | 'LODGING'
  | 'CAR_RENTAL'
  | 'EXPERIENCES'
  | 'CONFIRM'
  | 'COMPLETE';

export interface TripState {
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  transport_mode: 'flying' | 'driving' | null;
  flights: Array<{ id: string }>;
  hotels: Array<{ id: string }>;
  car_rentals?: Array<{ id: string }>;
  experiences: Array<{ id: string }>;
  status: string;
}

export function getBookingStep(trip: TripState): BookingStep {
  if (trip.status !== 'planning') {
    return 'COMPLETE';
  }

  if (
    trip.budget_total === null ||
    trip.departure_date === null ||
    trip.return_date === null ||
    trip.origin === null
  ) {
    return 'COLLECT_DETAILS';
  }

  if (trip.transport_mode === null) {
    return 'TRANSPORT';
  }

  if (trip.transport_mode === 'flying' && trip.flights.length === 0) {
    return 'TRANSPORT';
  }

  if (trip.hotels.length === 0) {
    return 'LODGING';
  }

  if (!trip.car_rentals || trip.car_rentals.length === 0) {
    return 'CAR_RENTAL';
  }

  if (trip.experiences.length === 0) {
    return 'EXPERIENCES';
  }

  return 'CONFIRM';
}

const SHARED_RULES = `
Rules:
- 1-2 sentences max text output. NEVER use numbered lists.
- NEVER describe search results in text — the UI cards handle display.
- Answer travel questions briefly, then redirect to current step.
- Call update_trip when the user provides trip details.
- Always call format_response as your LAST tool call.
- Max 15 tool calls per turn.`.trim();

const STEP_PROMPTS: Record<BookingStep, string> = {
  COLLECT_DETAILS: `A form is being shown to collect trip details. Acknowledge the destination in one sentence. Do NOT ask questions — the form handles it.`,

  TRANSPORT: `Ask: "Will you be flying or driving?" If flying, ask time preference, then search flights. If driving, call update_trip with transport_mode: "driving". Provide quick_replies: ["I'll be flying", "I'll drive"].`,

  LODGING: `Ask: "Do you need a hotel?" If yes, search hotels. Provide quick_replies: ["Yes, find me a hotel", "No, I have lodging"].`,

  CAR_RENTAL: `Ask: "Will you need a rental car?" If yes, search car rentals. If the user already declined in conversation history, skip. Provide quick_replies: ["Yes, find me a car", "No, I don't need one"].`,

  EXPERIENCES: `Based on user preferences (dietary, intensity, social), suggest categories briefly. Search experiences. Provide quick_replies: ["Find dining options", "Show me adventures", "I'm all set"].`,

  CONFIRM: `Summarize the trip briefly in markdown (destination, dates, selections, total cost). Ask "Ready to book?" Provide quick_replies: ["Confirm booking", "Make changes"].`,

  COMPLETE: `Trip is booked. Answer follow-up questions about the trip.`,
};

export function getStepPrompt(step: BookingStep): string {
  return `${STEP_PROMPTS[step]}\n\n${SHARED_RULES}`;
}
