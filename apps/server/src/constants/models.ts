/**
 * Anthropic model identifiers and default model-call parameters.
 * Centralizes model IDs so call sites never hardcode version strings (R-219),
 * and so a model bump is a one-line change in a single place.
 */
export const DEFAULT_MAX_TOKENS = 2048;
export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
