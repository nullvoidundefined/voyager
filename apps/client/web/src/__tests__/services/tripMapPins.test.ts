import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTripMapPins } from '@/services/tripMapPins';

vi.mock('@/api/request', () => ({
  get: vi.fn(),
}));

const { get } = await import('@/api/request');
const mockGet = vi.mocked(get);

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const TOKEN = 'pk.test-token';

const AIRPORT_COORDINATES: Record<
  string,
  { city: string; lat: number; lon: number }
> = {
  AUH: { city: 'Abu Dhabi', lat: 24.4539, lon: 54.3773 },
  SFO: { city: 'San Francisco', lat: 37.7749, lon: -122.4194 },
};

function makeTrip(overrides: Record<string, unknown> = {}) {
  return {
    destination: 'Abu Dhabi',
    experiences: [],
    flights: [],
    hotels: [],
    ...overrides,
  };
}

// 2026-07-07 Iloilo-City incident: flight pins were built by free-text Mapbox
// geocoding of "<IATA> airport" strings; Mapbox matched "SFO airport" to a
// neighborhood named "Airport" in Iloilo City, Philippines, and the map
// centered there for an Abu Dhabi trip. Airport pins must resolve through the
// backend's local IATA database, never through free-text geocoding.
describe('buildTripMapPins', () => {
  beforeEach(() => {
    mockGet.mockImplementation((path: string) => {
      const code = path.split('/').pop() ?? '';
      const airport = AIRPORT_COORDINATES[code.toUpperCase()];
      if (!airport) {
        return Promise.reject(new Error('404'));
      }
      return Promise.resolve({ code: code.toUpperCase(), ...airport });
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          features: [{ center: [54.36, 24.49] }],
        }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves airport pins from the backend IATA endpoint with real coordinates', async () => {
    const trip = makeTrip({
      flights: [{ destination: 'AUH', id: 'f1', origin: 'SFO' }],
    });

    const pins = await buildTripMapPins(trip, TOKEN);

    const auhPin = pins.find((p) => p.id === 'airport-AUH');
    expect(auhPin).toMatchObject({ lat: 24.4539, lng: 54.3773, type: 'leg' });
    expect(mockGet).toHaveBeenCalledWith('/places/airport/AUH');
    expect(mockGet).toHaveBeenCalledWith('/places/airport/SFO');
  });

  it('never sends an airport query to the Mapbox geocoder', async () => {
    const trip = makeTrip({
      flights: [{ destination: 'AUH', id: 'f1', origin: 'SFO' }],
    });

    await buildTripMapPins(trip, TOKEN);

    const mapboxAirportCalls = mockFetch.mock.calls.filter(([url]) =>
      String(url).toLowerCase().includes('airport'),
    );
    expect(mapboxAirportCalls).toHaveLength(0);
  });

  it('orders the destination airport before the origin so the map centers on the trip destination', async () => {
    const trip = makeTrip({
      flights: [{ destination: 'AUH', id: 'f1', origin: 'SFO' }],
    });

    const pins = await buildTripMapPins(trip, TOKEN);

    expect(pins[0]?.id).toBe('airport-AUH');
  });

  it('skips airport pins for codes the backend does not know', async () => {
    const trip = makeTrip({
      flights: [{ destination: 'ZZZ', id: 'f1', origin: 'SFO' }],
    });

    const pins = await buildTripMapPins(trip, TOKEN);

    expect(pins.some((p) => p.id === 'airport-ZZZ')).toBe(false);
    expect(pins.some((p) => p.id === 'airport-SFO')).toBe(true);
  });

  it('still geocodes hotels through Mapbox and lists hotel pins first', async () => {
    const trip = makeTrip({
      flights: [{ destination: 'AUH', id: 'f1', origin: 'SFO' }],
      hotels: [{ city: 'Abu Dhabi', id: 'h1', name: 'Emirates Palace' }],
    });

    const pins = await buildTripMapPins(trip, TOKEN);

    expect(pins[0]).toMatchObject({ id: 'h1', type: 'hotel' });
    const hotelGeocodeCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes('Emirates'),
    );
    expect(hotelGeocodeCall).toBeDefined();
  });
});
