/**
 * Fetches US State Department travel advisories from the official JSON feed and
 * returns the matching destination advisory as a ChatNode, caching the feed for
 * a day. Exists to surface official US government guidance as one enrichment
 * source.
 */
import type { ChatNode } from '@voyager/shared-types';

import { logger } from 'app/clients/logger.js';
import { cacheGet, cacheSet } from 'app/services/cache/cacheService.js';

const CACHE_TTL = 86400; // 24 hours
const FEED_CACHE_KEY = 'enrichment:state_dept:feed';
const STATE_DEPT_URL =
  'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.json';

async function getAdvisoryFeed(): Promise<Record<string, unknown>[] | null> {
  const cached = await cacheGet<Record<string, unknown>[]>(FEED_CACHE_KEY);
  if (cached) return cached;

  try {
    const response = await fetch(STATE_DEPT_URL, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      logger.warn(
        { source: 'state_dept', status: response.status },
        'State Dept advisory feed responded non-ok',
      );
      return null;
    }

    const data = await response.json();
    const advisories = (data.advisories ?? data) as Record<string, unknown>[];
    await cacheSet(FEED_CACHE_KEY, advisories, CACHE_TTL);
    return advisories;
  } catch (err) {
    logger.warn(
      { source: 'state_dept', err },
      'State Dept advisory feed fetch failed',
    );
    return null;
  }
}

export async function fetchStateDeptAdvisory(
  countryCode: string,
): Promise<ChatNode | null> {
  const cacheKey = `enrichment:state_dept:${countryCode}`;
  const cached = await cacheGet<ChatNode>(cacheKey);
  if (cached) return cached;

  try {
    const advisories = await getAdvisoryFeed();
    if (!advisories) return null;

    const match = advisories.find(
      (a) =>
        (a['iso_code'] as string)?.toUpperCase() ===
          countryCode.toUpperCase() ||
        (a['country_code'] as string)?.toUpperCase() ===
          countryCode.toUpperCase(),
    );

    if (!match) return null;

    const level = (match['advisory_level'] ?? match['level']) as number;
    const severity: 'info' | 'warning' | 'critical' =
      level >= 4 ? 'critical' : level >= 3 ? 'warning' : 'info';
    const levelLabels: Record<number, string> = {
      1: 'Exercise Normal Precautions',
      2: 'Exercise Increased Caution',
      3: 'Reconsider Travel',
      4: 'Do Not Travel',
    };

    const node: ChatNode = {
      type: 'advisory',
      severity,
      title: `US State Dept Advisory: Level ${level} — ${levelLabels[level] ?? 'Unknown'}`,
      body:
        (match['advisory_text'] as string) ??
        `Travel advisory level ${level} for this destination.`,
    };

    await cacheSet(cacheKey, node, CACHE_TTL);
    return node;
  } catch (err) {
    logger.warn(
      { source: 'state_dept', countryCode, err },
      'State Dept advisory lookup failed',
    );
    return null;
  }
}
