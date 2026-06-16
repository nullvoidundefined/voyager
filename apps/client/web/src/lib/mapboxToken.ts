/**
 * Reads the public Mapbox token from the environment, throwing if absent so a
 * misconfigured deploy fails loudly at the call site instead of rendering a
 * silently broken map.
 */

export function getMapboxToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    throw new Error('NEXT_PUBLIC_MAPBOX_TOKEN is not set');
  }
  return token;
}
