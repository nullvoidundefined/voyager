/**
 * Booking-flow domain model: per-segment completion tracker status and flow
 * position, keyed by the active journey's segment list. Provides the shared
 * vocabulary that prompt builders use to describe where a trip stands in the
 * multi-step booking process, so every sub-agent reports progress consistently.
 */
import {
  JOURNEY_TYPE_IDS,
  type JourneyTypeId,
  type SegmentKind,
} from '@repo/types';

import { getJourneyType } from 'app/journeys/registry.js';
import { getSegmentKindForPlanCategory } from 'app/segments/planCategoryIndex.js';
import { getSegmentCapability } from 'app/segments/registry/index.js';

// --- Types ---

export type TrackerStatus =
  | 'pending'
  | 'searching'
  | 'selected'
  | 'skipped'
  | 'not_applicable';

// --- Status predicates (exhaustive switches so TS errors on new variants) ---

/** Segment needs agent attention: not yet started or results shown but unselected. */
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

/** Segment requires no further action. */
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
  journeyType: JourneyTypeId;
  /** Retained for v3 parity; journey inference replaces it in Phase 5. */
  transport: 'pending' | 'flying' | 'driving';
  segments: Partial<Record<SegmentKind, TrackerStatus>>;
  plan_confirmed: boolean;
  segment_interests: Partial<Record<SegmentKind, string[]>>;
  turns_since_last_progress: number;
}

export const CURRENT_TRACKER_VERSION = 4;

const TRACKER_VERSION_V2 = 2;
const TRACKER_VERSION_V3 = 3;
const NUDGE_AFTER_STALLED_TURNS = 3;

function buildDefaultSegments(
  journeyType: JourneyTypeId,
): Partial<Record<SegmentKind, TrackerStatus>> {
  const segments: Partial<Record<SegmentKind, TrackerStatus>> = {};
  for (const slot of getJourneyType(journeyType).segments) {
    segments[slot.kind] = 'pending';
  }
  return segments;
}

export const DEFAULT_COMPLETION_TRACKER: CompletionTracker = {
  journeyType: 'flight_trip',
  plan_confirmed: false,
  segment_interests: {},
  segments: buildDefaultSegments('flight_trip'),
  transport: 'pending',
  turns_since_last_progress: 0,
  version: CURRENT_TRACKER_VERSION,
};

// --- Segment lookups ---

/** Segment kinds of the tracker's journey, in journey (routing) order. */
export function listJourneySegments(tracker: CompletionTracker): SegmentKind[] {
  return getJourneyType(tracker.journeyType).segments.map((slot) => slot.kind);
}

export function getSegmentStatus(
  tracker: CompletionTracker,
  kind: SegmentKind,
): TrackerStatus {
  return tracker.segments[kind] ?? 'pending';
}

// --- v1/v2 -> v3 migration helpers ---

const V1_STATUS_MAP: Record<string, TrackerStatus> = {
  asking: 'pending',
  done: 'selected',
  idle: 'pending',
  presented: 'searching',
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

function validTransport(val: unknown): CompletionTracker['transport'] {
  return VALID_TRANSPORT.includes(val as string)
    ? (val as CompletionTracker['transport'])
    : 'pending';
}

/** The v3 named-field shape, used only as a migration intermediate. */
interface V3Tracker {
  transport: CompletionTracker['transport'];
  flights: TrackerStatus;
  hotels: TrackerStatus;
  car_rental: TrackerStatus;
  experiences: TrackerStatus;
  plan_confirmed: boolean;
  experience_interests: string[];
  turns_since_last_progress: number;
}

/** The pre-v4 branches, verbatim: v1 object-statuses, v2 missing plan fields, v3. */
function normalizeToV3(obj: Record<string, unknown>): V3Tracker {
  if (!('version' in obj) || (obj.version as number) < TRACKER_VERSION_V2) {
    return migrateV1ToV3(obj);
  }
  if ((obj.version as number) < TRACKER_VERSION_V3) {
    return migrateV2ToV3(obj);
  }
  return sanitizeV3(obj);
}

/** v1 migration: BookingState with { status: 'idle' } objects. */
function migrateV1ToV3(obj: Record<string, unknown>): V3Tracker {
  return {
    car_rental: migrateV1Status(obj.car_rental),
    experience_interests: [],
    experiences: migrateV1Status(obj.experiences),
    flights: migrateV1Status(obj.flights),
    hotels: migrateV1Status(obj.hotels),
    plan_confirmed: false,
    transport: 'pending',
    turns_since_last_progress: 0,
  };
}

/** v2 -> v3: adds plan_confirmed and experience_interests, so all existing
 *  trips re-enter the plan phase on next message. */
function migrateV2ToV3(obj: Record<string, unknown>): V3Tracker {
  return {
    car_rental: validStatus(obj.car_rental),
    experience_interests: [],
    experiences: validStatus(obj.experiences),
    flights: validStatus(obj.flights),
    hotels: validStatus(obj.hotels),
    plan_confirmed: false,
    transport: validTransport(obj.transport),
    turns_since_last_progress: validTurnCount(obj.turns_since_last_progress),
  };
}

/** Field-validates an object already carrying the v3 shape. */
function sanitizeV3(obj: Record<string, unknown>): V3Tracker {
  return {
    car_rental: validStatus(obj.car_rental),
    experience_interests: Array.isArray(obj.experience_interests)
      ? obj.experience_interests.filter(
          (i): i is string => typeof i === 'string',
        )
      : [],
    experiences: validStatus(obj.experiences),
    flights: validStatus(obj.flights),
    hotels: validStatus(obj.hotels),
    plan_confirmed:
      typeof obj.plan_confirmed === 'boolean' ? obj.plan_confirmed : false,
    transport: validTransport(obj.transport),
    turns_since_last_progress: validTurnCount(obj.turns_since_last_progress),
  };
}

function validTurnCount(val: unknown): number {
  return typeof val === 'number' ? val : 0;
}

function validJourneyType(val: unknown): JourneyTypeId {
  return JOURNEY_TYPE_IDS.includes(val as JourneyTypeId)
    ? (val as JourneyTypeId)
    : 'flight_trip';
}

function normalizeSegments(
  raw: unknown,
): Partial<Record<SegmentKind, TrackerStatus>> {
  const segments: Partial<Record<SegmentKind, TrackerStatus>> = {};
  if (typeof raw !== 'object' || raw === null) return segments;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (getSegmentKindForPlanCategory(key) !== undefined) continue; // plural keys never valid here
    segments[key as SegmentKind] = validStatus(value);
  }
  return segments;
}

function normalizeSegmentInterests(
  raw: unknown,
): Partial<Record<SegmentKind, string[]>> {
  const interests: Partial<Record<SegmentKind, string[]>> = {};
  if (typeof raw !== 'object' || raw === null) return interests;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    interests[key as SegmentKind] = value.filter(
      (i): i is string => typeof i === 'string',
    );
  }
  return interests;
}

export function normalizeCompletionTracker(raw: unknown): CompletionTracker {
  if (raw === null || raw === undefined) {
    return structuredClone(DEFAULT_COMPLETION_TRACKER);
  }
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.version === 'number' &&
    obj.version >= CURRENT_TRACKER_VERSION
  ) {
    return sanitizeV4(obj);
  }
  return migrateV3ToV4(normalizeToV3(obj));
}

/** Field-validates an object already carrying the v4 shape. */
function sanitizeV4(obj: Record<string, unknown>): CompletionTracker {
  return {
    journeyType: validJourneyType(obj.journeyType),
    plan_confirmed:
      typeof obj.plan_confirmed === 'boolean' ? obj.plan_confirmed : false,
    segment_interests: normalizeSegmentInterests(obj.segment_interests),
    segments: normalizeSegments(obj.segments),
    transport: validTransport(obj.transport),
    turns_since_last_progress: validTurnCount(obj.turns_since_last_progress),
    version: CURRENT_TRACKER_VERSION,
  };
}

/** v3 -> v4: named category fields become the segment map under the only
 *  journey that existed before v4. */
function migrateV3ToV4(v3: V3Tracker): CompletionTracker {
  return {
    journeyType: 'flight_trip',
    plan_confirmed: v3.plan_confirmed,
    segment_interests:
      v3.experience_interests.length > 0
        ? { experience: v3.experience_interests }
        : {},
    segments: {
      car_rental: v3.car_rental,
      experience: v3.experiences,
      flight: v3.flights,
      hotel: v3.hotels,
    },
    transport: v3.transport,
    turns_since_last_progress: v3.turns_since_last_progress,
    version: CURRENT_TRACKER_VERSION,
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

  // When a plan-aware tracker is provided, gate on plan_confirmed
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
  formatResponse?: { skip_category?: string | boolean } | null;
}

/** Read a trip's selection collection by the capability's selectionKey. */
function getTripSelections(
  trip: TripState,
  selectionKey: string,
): Array<{ id: string }> {
  const collection = (trip as unknown as Record<string, unknown>)[selectionKey];
  return Array.isArray(collection) ? (collection as Array<{ id: string }>) : [];
}

export function updateCompletionTracker(
  tracker: CompletionTracker,
  agentResult: AgentResultForTracker,
  updatedTrip: TripState,
): CompletionTracker {
  const newTracker: CompletionTracker = {
    ...tracker,
    segments: { ...tracker.segments },
  };

  const changed = [
    recordTransportMode(newTracker, updatedTrip),
    markSearchedSegments(newTracker, agentResult),
    markSelectedSegments(newTracker, agentResult, updatedTrip),
    markSelectionsFromTripRecord(newTracker, updatedTrip),
    markSkippedCategory(newTracker, agentResult),
    reopenRequestedCategories(newTracker, agentResult),
  ].some(Boolean);

  newTracker.turns_since_last_progress = changed
    ? 0
    : tracker.turns_since_last_progress + 1;

  return newTracker;
}

/** Records a decided transport mode; driving skips a still-pending flight. */
function recordTransportMode(
  tracker: CompletionTracker,
  updatedTrip: TripState,
): boolean {
  if (!updatedTrip.transport_mode || tracker.transport !== 'pending') {
    return false;
  }
  tracker.transport = updatedTrip.transport_mode;
  if (
    updatedTrip.transport_mode === 'driving' &&
    getSegmentStatus(tracker, 'flight') === 'pending'
  ) {
    tracker.segments.flight = 'skipped';
  }
  return true;
}

/** Search tool calls move segments to searching (never downgrading selected/not_applicable). */
function markSearchedSegments(
  tracker: CompletionTracker,
  agentResult: AgentResultForTracker,
): boolean {
  let changed = false;
  for (const kind of listJourneySegments(tracker)) {
    const { searchTool } = getSegmentCapability(kind);
    if (agentResult.tool_calls.some((tc) => tc.tool_name === searchTool)) {
      const status = getSegmentStatus(tracker, kind);
      if (needsWork(status) || status === 'skipped') {
        tracker.segments[kind] = 'searching';
        changed = true;
      }
    }
  }
  return changed;
}

/** Select tool calls backed by a persisted trip selection mark the segment selected. */
function markSelectedSegments(
  tracker: CompletionTracker,
  agentResult: AgentResultForTracker,
  updatedTrip: TripState,
): boolean {
  let changed = false;
  for (const kind of listJourneySegments(tracker)) {
    const capability = getSegmentCapability(kind);
    if (
      agentResult.tool_calls.some(
        (tc) => tc.tool_name === capability.selectTool,
      ) &&
      getTripSelections(updatedTrip, capability.selectionKey).length > 0
    ) {
      tracker.segments[kind] = 'selected';
      changed = true;
    }
  }
  return changed;
}

/** Ground truth: trip record selections override the tracker. */
function markSelectionsFromTripRecord(
  tracker: CompletionTracker,
  updatedTrip: TripState,
): boolean {
  let changed = false;
  for (const kind of listJourneySegments(tracker)) {
    const { selectionKey } = getSegmentCapability(kind);
    if (
      getTripSelections(updatedTrip, selectionKey).length > 0 &&
      getSegmentStatus(tracker, kind) !== 'selected'
    ) {
      tracker.segments[kind] = 'selected';
      changed = true;
    }
  }
  return changed;
}

/** skip_category carries a legacy plural wire value ('flights', 'hotels', ...). */
function markSkippedCategory(
  tracker: CompletionTracker,
  agentResult: AgentResultForTracker,
): boolean {
  const skipCat = agentResult.formatResponse?.skip_category;
  if (typeof skipCat !== 'string') return false;
  const kind = getSegmentKindForPlanCategory(skipCat);
  if (kind === undefined) return false;
  tracker.segments[kind] = 'skipped';
  return true;
}

/** re_open_category carries a legacy plural wire value ('flights', 'hotels', ...). */
function reopenRequestedCategories(
  tracker: CompletionTracker,
  agentResult: AgentResultForTracker,
): boolean {
  let changed = false;
  for (const tc of agentResult.tool_calls) {
    if (tc.tool_name !== 're_open_category') continue;
    const cat = tc.input?.category;
    if (typeof cat !== 'string') continue;
    const kind = getSegmentKindForPlanCategory(cat);
    if (kind === undefined) continue;
    tracker.segments[kind] = 'pending';
    changed = true;
  }
  return changed;
}

// --- Nudge computation ---

export function computeNudge(tracker: CompletionTracker): string | null {
  if (tracker.turns_since_last_progress < NUDGE_AFTER_STALLED_TURNS)
    return null;

  const unstarted: string[] = [];
  const stalled: string[] = [];
  for (const kind of listJourneySegments(tracker)) {
    // Legacy plural label ('flights', 'car rental') for prompt parity.
    const label = getSegmentCapability(kind).planCategoryId.replace('_', ' ');
    const status = getSegmentStatus(tracker, kind);
    if (status === 'pending') unstarted.push(label);
    else if (status === 'searching') stalled.push(label);
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
  return listJourneySegments(tracker).some(
    (kind) => getSegmentStatus(tracker, kind) === 'selected',
  );
}

export function allCategoriesResolved(tracker: CompletionTracker): boolean {
  return listJourneySegments(tracker).every((kind) =>
    isResolved(getSegmentStatus(tracker, kind)),
  );
}

/** Every segment is either unstarted or explicitly skipped -- no active engagement. */
export function noEngagement(tracker: CompletionTracker): boolean {
  return listJourneySegments(tracker).every((kind) => {
    const status = getSegmentStatus(tracker, kind);
    return status === 'pending' || status === 'skipped';
  });
}
