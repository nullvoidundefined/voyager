import { describe, expect, it } from 'vitest';

import { executeTool } from 'app/tools/executor.js';

describe('executeTool: discover_destinations', () => {
  it('returns ranked destinations for a valid query', async () => {
    const result = (await executeTool('discover_destinations', {
      climate: 'warm',
      limit: 3,
    })) as { destinations: unknown[]; status: string };
    expect(result.status).toBe('ok');
    expect(result.destinations.length).toBeGreaterThan(0);
    expect(result.destinations.length).toBeLessThanOrEqual(3);
  });

  it('returns a validation error for a malformed limit', async () => {
    const result = (await executeTool('discover_destinations', {
      limit: 99,
    })) as { error?: string };
    expect(result.error).toContain('Validation failed');
  });
});
