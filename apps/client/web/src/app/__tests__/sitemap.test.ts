import { describe, expect, it } from 'vitest';

import robots from '../robots';
import sitemap from '../sitemap';

describe('sitemap', () => {
  it('includes the home route', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith('/'))).toBe(true);
  });

  it('includes the explore route', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes('/explore'))).toBe(true);
  });
});

describe('robots', () => {
  it('disallows /api and /trips', () => {
    const result = robots();
    const disallowed = result.rules.disallow ?? [];
    const list = Array.isArray(disallowed) ? disallowed : [disallowed];
    expect(list).toContain('/api');
    expect(list.some((r) => r.startsWith('/trips'))).toBe(true);
  });
});
