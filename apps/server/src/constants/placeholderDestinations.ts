/**
 * Shared vocabulary for the "no destination decided yet" convention used
 * across trip creation and the chat/booking flow. A trip's destination field
 * is never empty at the schema level (the "undecided" entry point seeds it
 * with a literal placeholder string), so callers that need to detect "the
 * user hasn't picked a destination yet" must check both the placeholder set
 * and the empty/whitespace-only case, not just falsy/empty.
 */
export const PLACEHOLDER_DESTINATIONS = new Set(['New trip', 'Planning...']);

/** True when destination is empty/whitespace-only or one of the known placeholder strings. */
export function isPlaceholderDestination(
  destination: string | null | undefined,
): boolean {
  if (destination === null || destination === undefined) return true;
  const trimmed = destination.trim();
  if (trimmed === '') return true;
  return PLACEHOLDER_DESTINATIONS.has(destination);
}
