import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TripMap } from '../TripMap';

const mockFetchWithBbox = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    features: [
      {
        center: [-8.22, 39.39],
        bbox: [-9.5, 36.8, -6.2, 42.2],
      },
    ],
  }),
});

const { mockMapboxgl, mockMapInstance } = vi.hoisted(() => {
  const mapInstance = {
    on: vi.fn().mockImplementation((event: string, cb: () => void) => {
      if (event === 'load') cb();
    }),
    fitBounds: vi.fn(),
    remove: vi.fn(),
  };
  const mapboxgl = {
    accessToken: '',
    Map: vi.fn().mockImplementation(() => mapInstance),
    Marker: vi.fn().mockImplementation(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      setPopup: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    Popup: vi.fn().mockImplementation(() => ({
      setHTML: vi.fn().mockReturnThis(),
    })),
  };
  return { mockMapInstance: mapInstance, mockMapboxgl: mapboxgl };
});

vi.mock('mapbox-gl', () => ({
  default: mockMapboxgl,
}));

const PINS = [
  {
    id: '1',
    lat: 40.71,
    lng: -74.01,
    label: 'Hotel Alpha',
    type: 'hotel' as const,
  },
  {
    id: '2',
    lat: 40.75,
    lng: -73.99,
    label: 'Central Park',
    type: 'experience' as const,
  },
];

describe('TripMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMapboxgl.accessToken = '';
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'test-mapboxToken';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  });

  it('renders the map container when API key is set', () => {
    render(<TripMap pins={PINS} />);
    expect(screen.getByTestId('trip-map')).toBeInTheDocument();
  });

  it('renders a fallback message when no API key is present', () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    render(<TripMap pins={[]} />);
    expect(screen.getByText(/map unavailable/i)).toBeInTheDocument();
  });

  it('sets the Mapbox accessToken from the env var before initializing the map', async () => {
    render(<TripMap pins={[]} />);
    await waitFor(() => expect(mockMapboxgl.Map).toHaveBeenCalled());
    expect(mockMapboxgl.accessToken).toBe('test-mapboxToken');
  });

  it('creates a Mapbox Map instance with the correct style', async () => {
    render(<TripMap pins={[]} />);
    await waitFor(() => expect(mockMapboxgl.Map).toHaveBeenCalled());
    expect(mockMapboxgl.Map).toHaveBeenCalledWith(
      expect.objectContaining({
        style: 'mapbox://styles/mapbox/streets-v12',
      }),
    );
  });
});

describe('TripMap geocoded view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMapboxgl.accessToken = '';
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'test-mapboxToken';
    mockMapInstance.on.mockImplementation((event: string, cb: () => void) => {
      if (event === 'load') cb();
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    vi.unstubAllGlobals();
  });

  it('centers a city geocode on the feature point at city zoom, ignoring an oversized bbox', async () => {
    // Mapbox returns Tokyo as a place with a bbox extending south-east to the
    // Ogasawara Islands (~1000km offshore). Naively fitting to that bbox puts
    // the map center in the Pacific Ocean. The component must use the feature
    // center and a place-appropriate zoom instead.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              place_type: ['place'],
              center: [139.6917, 35.6895],
              bbox: [138.94, 24.22, 142.31, 35.9],
            },
          ],
        }),
      }),
    );

    render(<TripMap pins={[]} destinationName='Tokyo' />);

    await waitFor(() => expect(mockMapboxgl.Map).toHaveBeenCalled());

    expect(mockMapboxgl.Map).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [139.6917, 35.6895],
        zoom: 11,
      }),
    );
    expect(mockMapInstance.fitBounds).not.toHaveBeenCalled();
  });

  it('zooms out for country-level geocode results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              place_type: ['country'],
              center: [-8.22, 39.39],
              bbox: [-9.5, 36.8, -6.2, 42.2],
            },
          ],
        }),
      }),
    );

    render(<TripMap pins={[]} destinationName='Portugal' />);

    await waitFor(() => expect(mockMapboxgl.Map).toHaveBeenCalled());

    expect(mockMapboxgl.Map).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [-8.22, 39.39],
        zoom: 5,
      }),
    );
    expect(mockMapInstance.fitBounds).not.toHaveBeenCalled();
  });

  it('does not call fitBounds when pins are present', async () => {
    vi.stubGlobal('fetch', mockFetchWithBbox);
    render(
      <TripMap
        pins={[
          { id: '1', lat: 38.7, lng: -9.1, label: 'Lisbon', type: 'hotel' },
        ]}
        destinationName='Portugal'
      />,
    );

    await waitFor(() => expect(mockMapboxgl.Map).toHaveBeenCalled());

    expect(mockMapInstance.fitBounds).not.toHaveBeenCalled();
  });
});
