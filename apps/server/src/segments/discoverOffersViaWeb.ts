/**
 * Cold-path inventory discovery: web-search a niche segment request, extract
 * structured candidate offers with the LLM, and strictly validate them before
 * anything reaches the knowledge base. This module is the poisoning-resistance
 * chokepoint: rows the schema rejects are dropped and logged, and booking URLs
 * must come from a host the search actually returned.
 */
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { getLlmClient } from 'app/clients/llm.js';
import { logger } from 'app/clients/logger.js';
import { DEFAULT_MODEL } from 'app/constants/models.js';
import type { DiscoveredOffer } from 'app/segments/segmentProvider.js';
import { tavilySearch } from 'app/services/external/tavilyService.js';
import type { TavilySearchResult } from 'app/services/external/tavilyTypes.js';

const EXTRACTION_MAX_TOKENS = 2048;
const MAX_TITLE_LENGTH = 200;
const MAX_PROVIDER_LENGTH = 120;
const CURRENCY_CODE_LENGTH = 3;
const MAX_URL_LENGTH = 500;
const MAX_SUMMARY_LENGTH = 500;
const RESULTS_JSON_INDENT = 2;
const DEFAULT_MAX_RESULTS = 5;

export interface WebDiscoveryInput {
  kind: string;
  region: string;
  routeKey?: string;
  /** Natural-language search query, built by the segment search wrapper. */
  query: string;
  maxResults?: number;
}

const extractedOfferSchema = z.object({
  booking_url: z.url().max(MAX_URL_LENGTH).optional(),
  currency: z.string().length(CURRENCY_CODE_LENGTH).optional(),
  price_estimate: z.number().positive().optional(),
  provider: z.string().max(MAX_PROVIDER_LENGTH).optional(),
  summary: z.string().max(MAX_SUMMARY_LENGTH).optional(),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
});

type ExtractedOffer = z.infer<typeof extractedOfferSchema>;

export async function discoverOffersViaWeb(
  input: WebDiscoveryInput,
): Promise<DiscoveredOffer[]> {
  if (!isWebDiscoveryEnabled()) {
    logger.info(
      { kind: input.kind, region: input.region },
      'Web discovery disabled (WEB_DISCOVERY_ENABLED != true); skipping cold path',
    );
    return [];
  }

  const results = await tavilySearch(input.query, {
    maxResults: input.maxResults ?? DEFAULT_MAX_RESULTS,
  });
  if (results.length === 0) return [];

  const rows = await extractOfferRows(input, results);
  const allowedHosts = collectResultHosts(results);
  const fetchedAt = new Date().toISOString();
  const provenance = results.map((result) => ({
    fetched_at: fetchedAt,
    url: result.url,
  }));

  return rows.map((row) =>
    toDiscoveredOffer(row, input, provenance, allowedHosts),
  );
}

function isWebDiscoveryEnabled(): boolean {
  return process.env.WEB_DISCOVERY_ENABLED === 'true';
}

/** One LLM extraction call over the search results; returns validated rows. */
async function extractOfferRows(
  input: WebDiscoveryInput,
  results: TavilySearchResult[],
): Promise<ExtractedOffer[]> {
  const response = await getLlmClient().messages.create({
    max_tokens: EXTRACTION_MAX_TOKENS,
    messages: [
      { content: buildExtractionPrompt(input, results), role: 'user' },
    ],
    model: DEFAULT_MODEL,
  });

  const text = findFirstTextBlock(response.content);
  if (!text) return [];

  const parsed = parseJsonArray(text);
  if (parsed === null) {
    logger.warn(
      { kind: input.kind, region: input.region },
      'Web discovery extraction returned non-JSON output; dropping',
    );
    return [];
  }

  return validateOfferRows(parsed, input.kind);
}

function findFirstTextBlock(
  content: Array<{ type: string }>,
): string | undefined {
  for (const block of content) {
    if (block.type === 'text' && 'text' in block) {
      return (block as { text: string }).text;
    }
  }
  return undefined;
}

/** Schema-filters extraction rows; rejected rows are logged, never stored. */
function validateOfferRows(
  candidates: unknown[],
  kind: string,
): ExtractedOffer[] {
  const rows: ExtractedOffer[] = [];
  for (const candidate of candidates) {
    const result = extractedOfferSchema.safeParse(candidate);
    if (result.success) {
      rows.push(result.data);
    } else {
      logger.warn(
        { issues: result.error.issues, kind },
        'Web discovery row failed validation; dropped',
      );
    }
  }
  return rows;
}

function buildExtractionPrompt(
  input: WebDiscoveryInput,
  results: TavilySearchResult[],
): string {
  return `You extract structured travel inventory from web search results.

Search intent: ${input.query}
Segment kind: ${input.kind}. Region: ${input.region}.${input.routeKey ? ` Route: ${input.routeKey}.` : ''}

From ONLY the search results below, list concrete bookable options (operators, named services, routes). Never invent an option that is not supported by the results. Prices are indicative; omit price_estimate when no price appears.

Respond with a JSON array only (no markdown, no code fences). Each element:
{"title":"...","provider":"...","price_estimate":123.45,"currency":"EUR","booking_url":"https://...","summary":"..."}
Omit any field you cannot support from the results. Return [] if the results contain no real options.

Search results:
${JSON.stringify(results, null, RESULTS_JSON_INDENT)}`;
}

function parseJsonArray(text: string): unknown[] | null {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/, '')
    .replace(/```$/, '')
    .trim();
  try {
    const value: unknown = JSON.parse(trimmed);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function collectResultHosts(results: TavilySearchResult[]): Set<string> {
  const hosts = new Set<string>();
  for (const result of results) {
    try {
      hosts.add(new URL(result.url).host);
    } catch {
      // unparseable result URL contributes no allowed host
    }
  }
  return hosts;
}

function toDiscoveredOffer(
  row: ExtractedOffer,
  input: WebDiscoveryInput,
  provenance: DiscoveredOffer['provenance'],
  allowedHosts: Set<string>,
): DiscoveredOffer {
  const detail: Record<string, string | number> = { title: row.title };
  if (row.provider) detail.provider = row.provider;
  if (row.summary) detail.summary = row.summary;

  return {
    id: randomUUID(),
    title: row.title,
    ...(row.provider ? { subtitle: row.provider } : {}),
    badges: [],
    currency: row.currency ?? 'USD',
    detail,
    price: row.price_estimate ?? 0,
    price_unit: 'per_person',
    selection_label: row.title,
    ...(isUrlFromResults(row.booking_url, allowedHosts)
      ? { booking_url: row.booking_url }
      : {}),
    provenance,
    region: input.region,
    ...(input.routeKey ? { route_key: input.routeKey } : {}),
  };
}

/** Booking URLs must point at a host the search actually returned. */
function isUrlFromResults(
  url: string | undefined,
  allowedHosts: Set<string>,
): url is string {
  if (!url) return false;
  try {
    return allowedHosts.has(new URL(url).host);
  } catch {
    return false;
  }
}
