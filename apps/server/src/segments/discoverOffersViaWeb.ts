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
import type { TavilySearchResult } from 'app/services/external/tavilyService.js';
import { tavilySearch } from 'app/services/external/tavilyService.js';

const EXTRACTION_MAX_TOKENS = 2048;
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
  title: z.string().min(1).max(200),
  provider: z.string().max(120).optional(),
  price_estimate: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  booking_url: z.url().max(500).optional(),
  summary: z.string().max(500).optional(),
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
    url: result.url,
    fetched_at: fetchedAt,
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
      { role: 'user', content: buildExtractionPrompt(input, results) },
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
        { kind, issues: result.error.issues },
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
${JSON.stringify(results, null, 2)}`;
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
    selection_label: row.title,
    price: row.price_estimate ?? 0,
    currency: row.currency ?? 'USD',
    price_unit: 'per_person',
    badges: [],
    detail,
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
