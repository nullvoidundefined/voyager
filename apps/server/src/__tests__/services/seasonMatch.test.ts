import { describe, expect, it } from 'vitest';

import { isMonthInBestSeason } from 'app/services/seasonMatch.js';

describe('isMonthInBestSeason', () => {
  it('matches a month inside a non-wrapping range', () => {
    expect(isMonthInBestSeason('March - May', 'April')).toBe(true);
  });

  it('rejects a month outside a non-wrapping range', () => {
    expect(isMonthInBestSeason('March - May', 'January')).toBe(false);
  });

  it('matches a month inside a wrapping range', () => {
    expect(isMonthInBestSeason('November - April', 'December')).toBe(true);
  });

  it('matches any month for "Year-round"', () => {
    expect(isMonthInBestSeason('Year-round', 'August')).toBe(true);
    expect(isMonthInBestSeason('Year-round', 'January')).toBe(true);
  });

  it('returns false for a malformed best_season string', () => {
    expect(isMonthInBestSeason('sometime nice', 'June')).toBe(false);
  });
});
