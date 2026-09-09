'use client';

/**
 * T4.1 — location acquisition, with three routes to a coordinate:
 *   1. GPS, with the accuracy radius shown and a draggable pin to correct it.
 *   2. GPS extracted from an uploaded photo's EXIF.
 *   3. A manual pin drop.
 *
 * The whole flow has to complete with location permission denied, because a
 * meaningful share of phones in the field will have it denied — sometimes
 * because the user tapped "block" once, months ago, on a different site.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { publicConfig } from '@/lib/public-config';

export type PickedLocation = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  source: 'GPS' | 'EXIF' | 'MANUAL';
};

type Props = {
  value: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
};

export function LocationStep({ value, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const requestGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('error');
      setMessage('This browser cannot report your location. Drop a pin on the map instead.');
      return;
    }

    setStatus('locating');
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus('idle');
        changeRef.current({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy ?? null,
          source: 'GPS',
        });
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission is off. Drag the pin to where the tree is, or upload a photo taken next to it.'
            : 'Could not get a GPS fix. Drag the pin to where the tree is.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }, []);

  // Ask once on mount: standing in front of the tree is the common case, and
  // making the contributor tap a button first wastes the fix they already have.
  useEffect(() => {
    requestGps();
  }, [requestGps]);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new maplibregl.Map({
      container: container.current,
      style: publicConfig.mapStyleUrl,
      center: value ? [value.longitude, value.latitude] : publicConfig.mapDefaultCenter,
      zoom: value ? 17 : publicConfig.mapDefaultZoom,
    });
    map.current = instance;

    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    instance.on('load', () => {
      instance.addSource('accuracy', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      // The accuracy circle is the honest part of a GPS reading: a 40 m fix
      // shown as a precise dot invites a contributor to trust it.
      instance.addLayer({
        id: 'accuracy-fill',
        type: 'circle',
        source: 'accuracy',
        paint: {
          'circle-color': '#1f4a2b',
          'circle-opacity': 0.12,
          'circle-stroke-color': '#1f4a2b',
          'circle-stroke-opacity': 0.4,
          'circle-stroke-width': 1,
          'circle-radius': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            10,
            ['/', ['get', 'accuracy'], 40],
            20,
            ['/', ['get', 'accuracy'], 0.04],
          ],
        },
      });
    });

    // Tapping the map moves the pin — the manual fallback (T4.1, route 3).
    instance.on('click', (event) => {
      changeRef.current({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
        accuracyM: null,
        source: 'MANUAL',
      });
    });

    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
    // Deliberately mount-only: `value` is applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !value) return;

    const position: [number, number] = [value.longitude, value.latitude];

    if (!marker.current) {
      marker.current = new maplibregl.Marker({ draggable: true, color: '#1f4a2b' })
        .setLngLat(position)
        .addTo(instance);

      marker.current.on('dragend', () => {
        const lngLat = marker.current!.getLngLat();
        changeRef.current({
          latitude: lngLat.lat,
          longitude: lngLat.lng,
          accuracyM: null,
          source: 'MANUAL',
        });
      });
    } else {
      marker.current.setLngLat(position);
    }

    instance.easeTo({ center: position, zoom: Math.max(instance.getZoom(), 16) });

    const source = instance.getSource('accuracy');
    if (source && 'setData' in source) {
      (source as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: value.accuracyM
          ? [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: position },
                properties: { accuracy: value.accuracyM },
              },
            ]
          : [],
      });
    }
  }, [value]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={requestGps}>
          {status === 'locating' ? 'Finding you…' : '📍 Use my location'}
        </button>
        {value ? (
          <p className="text-sm text-stone-600">
            <span className="font-mono">
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </span>
            {value.accuracyM ? (
              <span className="ml-2 text-stone-500">±{Math.round(value.accuracyM)} m</span>
            ) : null}
            <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs uppercase text-stone-500">
              {value.source}
            </span>
          </p>
        ) : (
          <p className="text-sm text-stone-500">No position yet — tap the map to drop a pin.</p>
        )}
      </div>

      {message ? (
        <p
          className={`rounded-lg border p-3 text-sm ${
            status === 'denied'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-stone-300 bg-stone-50 text-stone-700'
          }`}
        >
          {message}
        </p>
      ) : null}

      <div
        ref={container}
        className="h-64 w-full overflow-hidden rounded-xl border border-stone-300 sm:h-72"
        data-testid="location-map"
      />
      <p className="text-xs text-stone-500">
        Tap the map or drag the pin to correct the position.
      </p>
    </div>
  );
}
