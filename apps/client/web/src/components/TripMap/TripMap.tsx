'use client';

/**
 * Interactive map rendering a trip's geographic locations and route, giving users a
 * spatial view of their itinerary alongside the textual schedule.
 */
import { useEffect, useRef } from 'react';

import styles from './TripMap.module.scss';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: 'hotel' | 'experience' | 'leg';
}

interface TripMapProps {
  pins: MapPin[];
  center?: [number, number];
  zoom?: number;
  destinationName?: string;
}

const PIN_COLORS: Record<MapPin['type'], string> = {
  hotel: '#005f8e',
  experience: '#d4882a',
  leg: '#2a7d4f',
};

const PLACEHOLDER_DESTINATIONS = new Set(['New trip', 'Planning...']);

// Per-place-type zoom. Mapbox bboxes can be misleading for administrative
// regions whose territory extends far offshore (Tokyo prefecture reaches the
// Ogasawara Islands ~1000km into the Pacific), so we ignore bbox entirely and
// center on the feature point at a type-appropriate zoom.
const ZOOM_BY_PLACE_TYPE: Record<string, number> = {
  country: 5,
  region: 7,
  district: 9,
  postcode: 11,
  place: 11,
  locality: 12,
  neighborhood: 13,
  address: 15,
  poi: 15,
};
const DEFAULT_GEOCODED_ZOOM = 11;

interface GeocodeResult {
  center: [number, number];
  zoom: number;
}

async function geocodeDestination(
  name: string,
  token: string,
): Promise<GeocodeResult | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json?access_token=${token}&limit=1&types=place,locality,region,country`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features: {
      place_type?: string[];
      center: [number, number];
    }[];
  };
  const feature = data.features[0];
  if (!feature) return null;
  const placeType = feature.place_type?.[0];
  const resolvedZoom =
    placeType != null
      ? (ZOOM_BY_PLACE_TYPE[placeType] ?? DEFAULT_GEOCODED_ZOOM)
      : DEFAULT_GEOCODED_ZOOM;
  return { center: feature.center, zoom: resolvedZoom };
}

export function TripMap({
  pins,
  center,
  zoom = 11,
  destinationName,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || !containerRef.current) return;

    let cancelled = false;

    async function initMap() {
      let resolvedCenter: [number, number];
      let resolvedZoom = zoom;

      if (center != null) {
        resolvedCenter = center;
      } else if (pins.length > 0) {
        resolvedCenter = [pins[0].lng, pins[0].lat];
      } else if (
        destinationName &&
        !PLACEHOLDER_DESTINATIONS.has(destinationName)
      ) {
        const geocoded = await geocodeDestination(destinationName, token!);
        if (cancelled) return;
        resolvedCenter = geocoded?.center ?? [0, 20];
        if (geocoded) resolvedZoom = geocoded.zoom;
      } else {
        resolvedCenter = [0, 20];
      }

      const { default: mapboxgl } = await import('mapbox-gl');
      if (cancelled || !containerRef.current) return;

      (mapboxgl as unknown as { accessToken: string }).accessToken = token!;

      const map = new (
        mapboxgl as unknown as { Map: new (opts: unknown) => unknown }
      ).Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: resolvedCenter,
        zoom: resolvedZoom,
      });

      mapRef.current = map;

      (map as { on: (event: string, cb: () => void) => void }).on(
        'load',
        () => {
          pins.forEach((pin) => {
            const el = document.createElement('div');
            el.style.backgroundColor = PIN_COLORS[pin.type];
            el.style.width = '14px';
            el.style.height = '14px';
            el.style.borderRadius = '50%';
            el.style.border = '2px solid #fff';

            const Popup = (
              mapboxgl as unknown as {
                Popup: new (opts: unknown) => {
                  setHTML: (h: string) => unknown;
                };
              }
            ).Popup;
            const popup = new Popup({ offset: 10 }).setHTML(
              `<strong>${pin.label}</strong>`,
            );

            const Marker = (
              mapboxgl as unknown as {
                Marker: new (opts: unknown) => {
                  setLngLat: (pos: [number, number]) => unknown;
                  setPopup: (p: unknown) => unknown;
                  addTo: (m: unknown) => unknown;
                };
              }
            ).Marker;
            const marker = new Marker({ element: el });
            (
              marker.setLngLat([pin.lng, pin.lat]) as {
                setPopup: (p: unknown) => unknown;
              }
            ).setPopup(popup);
            (marker as unknown as { addTo: (m: unknown) => unknown }).addTo(
              map,
            );
            markersRef.current.push(marker);
          });
        },
      );
    }

    void initMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => (m as { remove: () => void }).remove());
      markersRef.current = [];
      if (mapRef.current) (mapRef.current as { remove: () => void }).remove();
      mapRef.current = null;
    };
  }, [pins, center, zoom, token, destinationName]);

  if (!token) {
    return (
      <div data-testid='trip-map' className={styles.unavailable}>
        <p>Map unavailable: Mapbox token not configured.</p>
      </div>
    );
  }

  return (
    <div data-testid='trip-map' ref={containerRef} className={styles.map} />
  );
}

/*
// ── Google Maps implementation (commented out for side-by-side comparison) ──

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const PLACEHOLDER_DESTINATIONS = new Set(['New trip', 'Planning...']);

export function TripMap({ pins, center, zoom = 11, destinationName }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;

    let cancelled = false;

    setOptions({ key: apiKey, v: 'weekly' });

    void (async () => {
      const { Map } = await importLibrary('maps');
      if (cancelled || !containerRef.current) return;

      let resolvedCenter: { lat: number; lng: number };

      if (center != null) {
        resolvedCenter = { lat: center[1], lng: center[0] };
      } else if (pins.length > 0) {
        resolvedCenter = { lat: pins[0].lat, lng: pins[0].lng };
      } else if (destinationName && !PLACEHOLDER_DESTINATIONS.has(destinationName)) {
        const { Geocoder } = await importLibrary('geocoding');
        if (cancelled) return;
        const geocoder = new Geocoder();
        const result = await geocoder.geocode({ address: destinationName });
        if (cancelled) return;
        if (result.results[0]?.geometry?.location) {
          const loc = result.results[0].geometry.location;
          resolvedCenter = { lat: loc.lat(), lng: loc.lng() };
        } else {
          resolvedCenter = { lat: 20, lng: 0 };
        }
      } else {
        resolvedCenter = { lat: 20, lng: 0 };
      }

      const map = new Map(containerRef.current, {
        center: resolvedCenter,
        zoom: destinationName && pins.length === 0 ? 10 : zoom,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: true,
        zoomControl: true,
      });

      mapRef.current = map;

      if (pins.length === 0) return;

      const { AdvancedMarkerElement } = await importLibrary('marker');
      if (cancelled) return;

      for (const pin of pins) {
        const dot = document.createElement('div');
        dot.style.cssText = `
          background:${PIN_COLORS[pin.type]};
          width:14px;height:14px;
          border-radius:50%;
          border:2px solid #fff;
          box-shadow:0 1px 3px rgba(0,0,0,.4);
        `;

        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: pin.lat, lng: pin.lng },
          content: dot,
          title: pin.label,
        });

        markersRef.current.push(marker);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => { m.map = null; });
      markersRef.current = [];
      mapRef.current = null;
    };
  }, [pins, center, zoom, apiKey, destinationName]);

  if (!apiKey) {
    return (
      <div data-testid='trip-map' className={styles.unavailable}>
        <p>Map unavailable: Google Maps API key not configured.</p>
      </div>
    );
  }

  return <div data-testid='trip-map' ref={containerRef} className={styles.map} />;
}
*/
