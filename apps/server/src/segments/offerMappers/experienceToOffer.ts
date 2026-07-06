/**
 * Maps a raw experience search item (Google Places shape or persisted
 * Experience tile) to the generic Offer. photo_ref rides in detail so the
 * client card can keep building its image URL.
 */
import type { Offer } from '@repo/types';

import { resolveOfferId } from 'app/segments/offerMappers/resolveOfferId.js';

interface ExperienceItem {
  id?: string;
  name: string;
  category?: string;
  photo_ref?: string;
  rating?: number;
  estimated_cost?: number;
  currency?: string;
  lat?: number;
  lon?: number;
  booking_url?: string;
}

export function experienceToOffer(item: unknown): Offer {
  const experience = item as ExperienceItem;
  const estimatedCost = experience.estimated_cost ?? 0;

  const detail: Record<string, string | number> = {
    estimated_cost: estimatedCost,
    name: experience.name,
  };
  if (experience.category) detail.category = experience.category;
  if (typeof experience.rating === 'number') {
    detail.rating = experience.rating;
  }
  if (experience.photo_ref) detail.photo_ref = experience.photo_ref;

  return {
    id: resolveOfferId(experience.id),
    title: experience.name,
    ...(experience.category ? { subtitle: experience.category } : {}),
    badges: [],
    currency: experience.currency ?? 'USD',
    detail,
    price: estimatedCost,
    price_unit: 'per_person',
    selection_label: experience.name,
    ...(experience.booking_url ? { booking_url: experience.booking_url } : {}),
    ...(typeof experience.lat === 'number' ? { lat: experience.lat } : {}),
    ...(typeof experience.lon === 'number' ? { lon: experience.lon } : {}),
  };
}
