/**
 * Converts persisted legacy per-category tile nodes (flight_tiles,
 * hotel_tiles, car_rental_tiles, experience_tiles) into the generic
 * offer_tiles node on read, so old conversations keep rendering after the
 * client dropped the legacy tile pipeline. Modern nodes pass through as-is.
 */
import type { ChatNode, Offer, OfferKind } from '@repo/types';

import { carRentalToOffer } from 'app/segments/offerMappers/carRentalToOffer.js';
import { experienceToOffer } from 'app/segments/offerMappers/experienceToOffer.js';
import { flightToOffer } from 'app/segments/offerMappers/flightToOffer.js';
import { hotelToOffer } from 'app/segments/offerMappers/hotelToOffer.js';

interface LegacyTileNode {
  type: string;
  selectable?: boolean;
  flights?: unknown[];
  hotels?: unknown[];
  rentals?: unknown[];
  experiences?: unknown[];
}

interface LegacyTileConversion {
  offerKind: OfferKind;
  listKey: keyof LegacyTileNode;
  toOffer: (item: unknown) => Offer;
}

const LEGACY_TILE_CONVERSIONS: Record<string, LegacyTileConversion> = {
  car_rental_tiles: {
    listKey: 'rentals',
    offerKind: 'car_rental',
    toOffer: carRentalToOffer,
  },
  experience_tiles: {
    listKey: 'experiences',
    offerKind: 'experience',
    toOffer: experienceToOffer,
  },
  flight_tiles: {
    listKey: 'flights',
    offerKind: 'flight',
    toOffer: flightToOffer,
  },
  hotel_tiles: { listKey: 'hotels', offerKind: 'hotel', toOffer: hotelToOffer },
};

export function normalizeLegacyNode(node: unknown): ChatNode {
  const candidate = node as LegacyTileNode | null;
  const conversion = candidate?.type
    ? LEGACY_TILE_CONVERSIONS[candidate.type]
    : undefined;
  if (!candidate || !conversion) return node as ChatNode;

  const items = candidate[conversion.listKey];
  return {
    offer_kind: conversion.offerKind,
    offers: Array.isArray(items) ? items.map(conversion.toOffer) : [],
    selectable: candidate.selectable ?? false,
    type: 'offer_tiles',
  };
}
