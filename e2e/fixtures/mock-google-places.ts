/**
 * Test-side mirror of the server's Google Places mock layer.
 *
 * Mirrors the deterministic shapes that
 * server/src/tools/mock/experiences.mock.ts emits when
 * E2E_MOCK_TOOLS=1 is set.
 */

export type GooglePlacesScenario = 'happy' | 'empty';

export interface MockExperience {
  id: string;
  displayName: string;
  formattedAddress: string;
  rating: number;
  priceLevel:
    | 'PRICE_LEVEL_INEXPENSIVE'
    | 'PRICE_LEVEL_MODERATE'
    | 'PRICE_LEVEL_EXPENSIVE';
  primaryTypeDisplayName: string;
}

const HAPPY_EXPERIENCES: MockExperience[] = [
  {
    id: 'mock-experience-0',
    displayName: 'Test Museum of Modern Art',
    formattedAddress: '151 Test St, San Francisco, CA',
    rating: 4.6,
    priceLevel: 'PRICE_LEVEL_MODERATE',
    primaryTypeDisplayName: 'Museum',
  },
  {
    id: 'mock-experience-1',
    displayName: 'Test Bay Cruise',
    formattedAddress: 'Pier 39, San Francisco, CA',
    rating: 4.4,
    priceLevel: 'PRICE_LEVEL_MODERATE',
    primaryTypeDisplayName: 'Tour',
  },
  {
    id: 'mock-experience-2',
    displayName: 'Test Wine Tasting',
    formattedAddress: '123 Vine Ave, Napa, CA',
    rating: 4.8,
    priceLevel: 'PRICE_LEVEL_EXPENSIVE',
    primaryTypeDisplayName: 'Tasting Room',
  },
];

export function getMockGooglePlaces(
  scenario: GooglePlacesScenario,
): MockExperience[] {
  return scenario === 'happy' ? HAPPY_EXPERIENCES : [];
}
