import { getDestinationInfo } from 'app/tools/destination.tool.js';
import { describe, expect, it } from 'vitest';

describe('destination.tool', () => {
  describe('getDestinationInfo', () => {
    it('returns IATA code for a known city', () => {
      const result = getDestinationInfo({ city_name: 'Barcelona' });
      expect(result.iata_code).toBe('BCN');
      expect(result.country).toBe('Spain');
      expect(result.timezone).toBeDefined();
      expect(result.currency).toBe('EUR');
    });

    it('is case-insensitive', () => {
      const result = getDestinationInfo({ city_name: 'barcelona' });
      expect(result.iata_code).toBe('BCN');
    });

    it('handles leading/trailing whitespace', () => {
      const result = getDestinationInfo({ city_name: '  Paris  ' });
      expect(result.iata_code).toBe('CDG');
      expect(result.country).toBe('France');
    });

    it('returns info for San Francisco', () => {
      const result = getDestinationInfo({ city_name: 'San Francisco' });
      expect(result.iata_code).toBe('SFO');
      expect(result.country).toBe('United States');
      expect(result.currency).toBe('USD');
    });

    it('returns info for Tokyo', () => {
      const result = getDestinationInfo({ city_name: 'Tokyo' });
      expect(result.iata_code).toBe('NRT');
      expect(result.country).toBe('Japan');
      expect(result.currency).toBe('JPY');
    });

    it('returns info for London', () => {
      const result = getDestinationInfo({ city_name: 'London' });
      expect(result.iata_code).toBe('LHR');
      expect(result.country).toBe('United Kingdom');
      expect(result.currency).toBe('GBP');
    });

    it('returns not_found for unknown cities', () => {
      const result = getDestinationInfo({ city_name: 'Xanadu' });
      expect(result.iata_code).toBeNull();
      expect(result.error).toContain('not found');
    });

    it('includes best_time_to_visit for known cities', () => {
      const result = getDestinationInfo({ city_name: 'Barcelona' });
      expect(result.best_time_to_visit).toBeDefined();
      expect(typeof result.best_time_to_visit).toBe('string');
    });

    it('covers major travel hubs', () => {
      const cities = [
        'New York',
        'Los Angeles',
        'Chicago',
        'Miami',
        'Rome',
        'Berlin',
        'Amsterdam',
        'Bangkok',
        'Sydney',
        'Dubai',
      ];

      for (const city of cities) {
        const result = getDestinationInfo({ city_name: city });
        expect(result.iata_code).not.toBeNull();
        expect(result.country).toBeDefined();
      }
    });
  });
});
