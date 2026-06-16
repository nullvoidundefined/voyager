import { describe, expect, it } from 'vitest';

import { formatCurrency, formatShortDate } from '../format';

describe('formatCurrency', () => {
  it('formats a USD amount with no decimal places', () => {
    expect(formatCurrency(1500, 'USD')).toBe('$1,500');
  });

  it('formats zero as $0', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0');
  });

  it('returns "-" for null', () => {
    expect(formatCurrency(null)).toBe('-');
  });

  it('defaults to USD when no currency is provided', () => {
    expect(formatCurrency(100)).toBe('$100');
  });

  it('formats EUR with the correct symbol', () => {
    const result = formatCurrency(200, 'EUR');
    expect(result).toContain('200');
    expect(result).toMatch(/EUR|€/);
  });

  it('caches formatter instances (calling twice does not throw)', () => {
    expect(() => {
      formatCurrency(100, 'GBP');
      formatCurrency(200, 'GBP');
    }).not.toThrow();
  });
});

describe('formatShortDate', () => {
  it('returns "Not set" for null', () => {
    expect(formatShortDate(null)).toBe('Not set');
  });

  it('returns "Not set" for undefined', () => {
    expect(formatShortDate(undefined)).toBe('Not set');
  });

  it('returns "Not set" for empty string', () => {
    expect(formatShortDate('')).toBe('Not set');
  });

  it('returns "Not set" for an invalid date string', () => {
    expect(formatShortDate('not-a-date')).toBe('Not set');
  });

  it('parses an ISO date string (YYYY-MM-DD) without timezone shift', () => {
    const result = formatShortDate('2026-08-15');
    expect(result).toContain('Aug');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('parses an ISO datetime string (contains T) without double-appending', () => {
    const result = formatShortDate('2026-08-15T12:00:00');
    expect(result).toContain('Aug');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('does not return "Not set" for valid dates', () => {
    expect(formatShortDate('2026-01-01')).not.toBe('Not set');
    expect(formatShortDate('2026-12-31')).not.toBe('Not set');
  });
});
