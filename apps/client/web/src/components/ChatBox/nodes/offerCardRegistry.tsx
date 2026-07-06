/**
 * Offer card registry: kind -> presentational card, virtualizer height
 * estimate, non-selectable layout, and legacy selection-message template.
 * Adding a travel mode adds one entry here; NodeRenderer and VirtualizedChat
 * never grow per-mode logic.
 */
import type { ReactNode } from 'react';

import type { Offer, OfferKind } from '@repo/types';

import { CarRentalOfferCard } from './offerCards/CarRentalOfferCard';
import { ExperienceOfferCard } from './offerCards/ExperienceOfferCard';
import { FallbackOfferCard } from './offerCards/FallbackOfferCard';
import { FlightOfferCard } from './offerCards/FlightOfferCard';
import { HotelOfferCard } from './offerCards/HotelOfferCard';

export interface OfferCardComponentProps {
  offer: Offer;
  selected?: boolean;
  onClick?: () => void;
}

export type OfferCardComponent = (props: OfferCardComponentProps) => ReactNode;

interface OfferCardEntry {
  Card: OfferCardComponent;
  heightEstimate: number;
  /** Layout for non-selectable renders (legacy: flights stacked vertically). */
  stackVertically?: boolean;
  /** Legacy per-kind chat message sent when the user confirms a selection. */
  selectionMessage: (label: string) => string;
}

const OFFER_CARD_REGISTRY: Partial<Record<OfferKind, OfferCardEntry>> = {
  car_rental: {
    Card: CarRentalOfferCard,
    heightEstimate: 240,
    selectionMessage: (label) => `I've selected the ${label} rental`,
  },
  experience: {
    Card: ExperienceOfferCard,
    heightEstimate: 200,
    selectionMessage: (label) => `I've selected ${label}`,
  },
  flight: {
    Card: FlightOfferCard,
    heightEstimate: 240,
    selectionMessage: (label) => `I've selected the ${label} flight`,
    stackVertically: true,
  },
  hotel: {
    Card: HotelOfferCard,
    heightEstimate: 240,
    selectionMessage: (label) => `I've selected ${label}`,
  },
};

const FALLBACK_ENTRY: OfferCardEntry = {
  Card: FallbackOfferCard,
  heightEstimate: 240,
  selectionMessage: (label) => `I've selected ${label}`,
};

export function resolveOfferCard(kind: OfferKind): OfferCardEntry {
  return OFFER_CARD_REGISTRY[kind] ?? FALLBACK_ENTRY;
}

export function getOfferTileHeightEstimate(kind: OfferKind): number {
  return resolveOfferCard(kind).heightEstimate;
}

export function buildOfferSelectionMessage(
  kind: OfferKind,
  label: string,
): string {
  return resolveOfferCard(kind).selectionMessage(label);
}
