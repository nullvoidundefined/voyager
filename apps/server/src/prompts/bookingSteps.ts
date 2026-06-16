/**
 * Booking-flow domain model: category names, per-category completion tracker
 * status, and flow position. Provides the shared vocabulary that prompt
 * builders use to describe where a trip stands in the multi-step booking
 * process, so every sub-agent reports progress consistently.
 */

// --- Types ---

export type CategoryName = 'flights' | 'hotels' | 'car_rental' | 'experiences';

export type TrackerStatus =
  | 'pending'
  | 'searching'
  | 'selected'
  | 'skipped'
  | 'not_applicable';

// --- Status predicates (exhaustive switches so TS errors on new variants) ---

/** Category needs agent attention: not yet started or results shown but unselected. */
export function needsWork(status: TrackerStatus): boolean {
  switch (status) {
    case 'pending':
    case 'searching':
      return true;
    case 'selected':
    case 'skipped':
    case 'not_applicable':
      return false;
  }
}

/** Category requires no further action. */
export function isResolved(status: TrackerStatus): boolean {
  switch (status) {
    case 'selected':
    case 'skipped':
    case 'not_applicable':
      return true;
    case 'pending':
    case 'searching':
      return false;
  }
}

/** Human-readable label for checklist display. */
export function statusLabel(status: TrackerStatus): string {
  switch (status) {
    case 'pending':
      return 'Not yet discussed';
    case 'searching':
      return 'Browsing options';
    case 'selected':
      return 'Selected';
    case 'skipped':
      return 'Skipped';
    case 'not_applicable':
      return 'N/A';
  }
}

export interface CompletionTracker {
  version: number;
  transport: 'pending' | 'flying' | 'driving';
  flights: TrackerStatus;
  hotels: TrackerStatus;
  car_rental: TrackerStatus;
  experiences: TrackerStatus;
  plan_confirmed: boolean;
  experience_interests: string[];
  turns_since_last_progress: number;
}

export const CURRENT_TRACKER_VERSION = 3;

export const DEFAULT_COMPLETION_TRACKER: CompletionTracker = {
  version: CURRENT_TRACKER_VERSION,
  transport: 'pending',
  flights: 'pending',
  hotels: 'pending',
  car_rental: 'pending',
  experiences: 'pending',
  plan_confirmed: false,
  experience_interests: [],
  turns_since_last_progress: 0,
};

export const SEARCH_TOOLS: Record<CategoryName, string> = {
  flights: 'search_flights',
  hotels: 'search_hotels',
  car_rental: 'search_car_rentals',
  experiences: 'search_experiences',
};

export const SELECTION_KEYS: Record<
  CategoryName,
  'flights' | 'hotels' | 'car_rentals' | 'experiences'
> = {
  flights: 'flights',
  hotels: 'hotels',
  car_rental: 'car_rentals',
  experiences: 'experiences',
};

const SELECT_TOOLS: Record<string, CategoryName> = {
  select_flight: 'flights',
  select_hotel: 'hotels',
  select_car_rental: 'car_rental',
  select_experience: 'experiences',
};

// --- v1 → v3 migration helpers ---

const V1_STATUS_MAP: Record<string, TrackerStatus> = {
  idle: 'pending',
  asking: 'pending',
  presented: 'searching',
  done: 'selected',
  skipped: 'skipped',
};

function migrateV1Status(v1Category: unknown): TrackerStatus {
  if (typeof v1Category === 'object' && v1Category !== null) {
    const status = (v1Category as Record<string, unknown>).status;
    if (typeof status === 'string' && status in V1_STATUS_MAP) {
      return V1_STATUS_MAP[
        status as keyof typeof V1_STATUS_MAP
      ] as TrackerStatus;
    }
  }
  return 'pending';
}

// --- Normalization ---

const VALID_TRACKER_STATUSES: TrackerStatus[] = [
  'pending',
  'searching',
  'selected',
  'skipped',
  'not_applicable',
];

const VALID_TRANSPORT = ['pending', 'flying', 'driving'];

function validStatus(val: unknown): TrackerStatus {
  return typeof val === 'string' &&
    VALID_TRACKER_STATUSES.includes(val as TrackerStatus)
    ? (val as TrackerStatus)
    : 'pending';
}

export function normalizeCompletionTracker(raw: unknown): CompletionTracker {
  if (raw === null || raw === undefined) {
    return { ...DEFAULT_COMPLETION_TRACKER };
  }

  const obj = raw as Record<string, unknown>;

  // v1 migration: BookingState with { status: 'idle' } objects
  if (!('version' in obj) || (obj.version as number) < 2) {
    return {
      version: CURRENT_TRACKER_VERSION,
      transport: 'pending',
      flights: migrateV1Status(obj.flights),
      hotels: migrateV1Status(obj.hotels),
      car_rental: migrateV1Status(obj.car_rental),
      experiences: migrateV1Status(obj.experiences),
      plan_confirmed: false,
      experience_interests: [],
      turns_since_last_progress: 0,
    };
  }

  // v2 → v3: add plan_confirmed and experience_interests
  // All existing trips re-enter the plan phase on next message.
  if ((obj.version as number) < 3) {
    return {
      version: CURRENT_TRACKER_VERSION,
      transport: VALID_TRANSPORT.includes(obj.transport as string)
        ? (obj.transport as CompletionTracker['transport'])
        : 'pending',
      flights: validStatus(obj.flights),
      hotels: validStatus(obj.hotels),
      car_rental: validStatus(obj.car_rental),
      experiences: validStatus(obj.experiences),
      plan_confirmed: false,
      experience_interests: [],
      turns_since_last_progress:
        typeof obj.turns_since_last_progress === 'number'
          ? obj.turns_since_last_progress
          : 0,
    };
  }

  // v3: current format
  return {
    version: CURRENT_TRACKER_VERSION,
    transport: VALID_TRANSPORT.includes(obj.transport as string)
      ? (obj.transport as CompletionTracker['transport'])
      : 'pending',
    flights: validStatus(obj.flights),
    hotels: validStatus(obj.hotels),
    car_rental: validStatus(obj.car_rental),
    experiences: validStatus(obj.experiences),
    plan_confirmed:
      typeof obj.plan_confirmed === 'boolean' ? obj.plan_confirmed : false,
    experience_interests: Array.isArray(obj.experience_interests)
      ? obj.experience_interests.filter(
          (i): i is string => typeof i === 'string',
        )
      : [],
    turns_since_last_progress:
      typeof obj.turns_since_last_progress === 'number'
        ? obj.turns_since_last_progress
        : 0,
  };
}

// --- Flow position ---

export type FlowPosition =
  | { phase: 'COLLECT_DETAILS' }
  | { phase: 'PLAN_TRIP' }
  | { phase: 'PLANNING' }
  | { phase: 'COMPLETE' };

export interface TripState {
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  transport_mode: 'flying' | 'driving' | null;
  trip_type?: 'round_trip' | 'one_way';
  flights: Array<{ id: string }>;
  hotels: Array<{ id: string }>;
  car_rentals?: Array<{ id: string }>;
  experiences: Array<{ id: string }>;
  status: string;
}

export function getFlowPosition(
  trip: TripState,
  tracker?: CompletionTracker | unknown,
): FlowPosition {
  if (trip.status !== 'planning') {
    return { phase: 'COMPLETE' };
  }

  const needsReturnDate = trip.trip_type !== 'one_way';
  if (
    trip.departure_date === null ||
    (needsReturnDate && trip.return_date === null) ||
    trip.origin === null
  ) {
    return { phase: 'COLLECT_DETAILS' };
  }

  // When a v3 tracker is provided, gate on plan_confirmed
  if (
    tracker !== null &&
    tracker !== undefined &&
    typeof tracker === 'object' &&
    'plan_confirmed' in (tracker as object)
  ) {
    if (!(tracker as CompletionTracker).plan_confirmed) {
      return { phase: 'PLAN_TRIP' };
    }
  }

  return { phase: 'PLANNING' };
}

// --- Tracker update ---

interface AgentResultForTracker {
  tool_calls: Array<{ tool_name: string; input?: Record<string, unknown> }>;
  formatResponse?: { skip_category?: CategoryName | boolean } | null;
}

const CATEGORIES: CategoryName[] = [
  'flights',
  'hotels',
  'car_rental',
  'experiences',
];

export function updateCompletionTracker(
  tracker: CompletionTracker,
  agentResult: AgentResultForTracker,
  updatedTrip: TripState,
): CompletionTracker {
  const newTracker = { ...tracker };
  let changed = false;

  // 1. Transport mode
  if (updatedTrip.transport_mode && newTracker.transport === 'pending') {
    newTracker.transport = updatedTrip.transport_mode;
    changed = true;
    if (
      updatedTrip.transport_mode === 'driving' &&
      newTracker.flights === 'pending'
    ) {
      newTracker.flights = 'skipped';
    }
  }

  // 2. Search tools → searching (don't downgrade selected/not_applicable)
  for (const cat of CATEGORIES) {
    const searchTool = SEARCH_TOOLS[cat];
    if (agentResult.tool_calls.some((tc) => tc.tool_name === searchTool)) {
      if (needsWork(newTracker[cat]) || newTracker[cat] === 'skipped') {
        newTracker[cat] = 'searching';
        changed = true;
      }
    }
  }

  // 3. Select tools + trip record → selected
  for (const [toolName, cat] of Object.entries(SELECT_TOOLS)) {
    if (agentResult.tool_calls.some((tc) => tc.tool_name === toolName)) {
      const selKey = SELECTION_KEYS[cat];
      const selections =
        selKey === 'car_rentals'
          ? (updatedTrip.car_rentals ?? [])
          : updatedTrip[selKey];
      if (selections.length > 0) {
        newTracker[cat] = 'selected';
        changed = true;
      }
    }
  }

  // 4. Ground truth: trip record selections override tracker
  for (const cat of CATEGORIES) {
    const selKey = SELECTION_KEYS[cat];
    const selections =
      selKey === 'car_rentals'
        ? (updatedTrip.car_rentals ?? [])
        : updatedTrip[selKey];
    if (selections.length > 0 && newTracker[cat] !== 'selected') {
      newTracker[cat] = 'selected';
      changed = true;
    }
  }

  // 5. skip_category
  const skipCat = agentResult.formatResponse?.skip_category;
  if (
    typeof skipCat === 'string' &&
    CATEGORIES.includes(skipCat as CategoryName)
  ) {
    newTracker[skipCat as CategoryName] = 'skipped';
    changed = true;
  }

  // 6. re_open_category tool calls
  for (const tc of agentResult.tool_calls) {
    if (tc.tool_name === 're_open_category') {
      const cat = tc.input?.category;
      if (typeof cat === 'string' && CATEGORIES.includes(cat as CategoryName)) {
        newTracker[cat as CategoryName] = 'pending';
        changed = true;
      }
    }
  }

  // 8. Progress counter
  if (changed) {
    newTracker.turns_since_last_progress = 0;
  } else {
    newTracker.turns_since_last_progress =
      tracker.turns_since_last_progress + 1;
  }

  return newTracker;
}

// --- Nudge computation ---

export function computeNudge(tracker: CompletionTracker): string | null {
  if (tracker.turns_since_last_progress < 3) return null;

  const unstarted: string[] = [];
  const stalled: string[] = [];
  for (const cat of CATEGORIES) {
    const label = cat.replace('_', ' ');
    if (tracker[cat] === 'pending') unstarted.push(label);
    else if (tracker[cat] === 'searching') stalled.push(label);
  }

  const parts: string[] = [];
  if (unstarted.length > 0) {
    parts.push(
      `you haven't discussed ${unstarted.join(', ')} with the user yet`,
    );
  }
  if (stalled.length > 0) {
    parts.push(
      `${stalled.join(', ')} results were shown but the user hasn't selected yet -- ask them to pick or skip`,
    );
  }

  if (parts.length === 0) return null;
  return `Note: ${parts.join('; ')}. Find a natural moment to address this.`;
}

// --- Empty itinerary check ---

export function hasAnySelection(tracker: CompletionTracker): boolean {
  return CATEGORIES.some((cat) => tracker[cat] === 'selected');
}

export function allCategoriesResolved(tracker: CompletionTracker): boolean {
  return CATEGORIES.every((cat) => isResolved(tracker[cat]));
}

/** Every category is either unstarted or explicitly skipped -- no active engagement. */
export function noEngagement(tracker: CompletionTracker): boolean {
  return CATEGORIES.every(
    (cat) => tracker[cat] === 'pending' || tracker[cat] === 'skipped',
  );
}
