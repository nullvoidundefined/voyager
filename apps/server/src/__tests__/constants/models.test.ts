import { describe, expect, it } from 'vitest';

import { DEFAULT_MODEL } from 'app/constants/models.js';

describe('DEFAULT_MODEL', () => {
  it('uses the current claude-sonnet-4-6 id, not the retired sonnet-4 snapshot', () => {
    expect(DEFAULT_MODEL).toBe('claude-sonnet-4-6');
  });
});
