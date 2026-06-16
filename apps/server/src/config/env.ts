/**
 * Environment predicates centralizing NODE_ENV checks so call sites read intent
 * (isProduction) instead of comparing the raw string in many places.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
