/**
 * Segment capability registry: one entry per SegmentKind, exhaustively keyed
 * so appending a kind to SEGMENT_KINDS fails compilation until registered.
 */
import type { SegmentKind } from '@repo/types';

import { carRentalCapability } from 'app/segments/registry/carRental.js';
import { experienceCapability } from 'app/segments/registry/experience.js';
import { flightCapability } from 'app/segments/registry/flight.js';
import { hotelCapability } from 'app/segments/registry/hotel.js';
import type { SegmentCapability } from 'app/segments/segmentCapability.js';

export const SEGMENT_CAPABILITIES: Record<SegmentKind, SegmentCapability> = {
  car_rental: carRentalCapability,
  experience: experienceCapability,
  flight: flightCapability,
  hotel: hotelCapability,
};

export function getSegmentCapability(kind: SegmentKind): SegmentCapability {
  return SEGMENT_CAPABILITIES[kind];
}
