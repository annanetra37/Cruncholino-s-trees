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
// MapLibre 6 dropped its default export; everything is a named export now.
import {
  MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { publicConfig } from '@/lib/public-config';
import { useT } from '@/i18n/client';

/** Close enough to identify which tree is meant; stop refining here. */
const GOOD_ACCURACY_M = 20;

/** Beyond this a reading is a network estimate, not a position on a street. */
const POOR_ACCURACY_M = 150;

/** How long to keep refining before settling for what the device can manage. */
const WATCH_FOR_MS = 20_000;

/** 12 m, 400 m, 50 km — rather than 50000 m, which reads as precision. */
function formatAccuracy(metres: number): string {
  if (metres >= 1000) return `${Math.round(metres / 1000)} km`;
  if (metres >= 100) return `${Math.round(metres / 50) * 50} m`;
  return `${Math.round(metres)} m`;
}

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
  const t = useT();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'error'>('idle');
  // The best accuracy seen so far, in metres. Fixes arrive coarse and improve;
  // keeping the best one stops a later, worse reading from undoing a good one.
  const bestAccuracy = useRef(Number.POSITIVE_INFINITY);
  const watchId = useRef<number | null>(null);
  const watchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The message is stored as a key, not a string, so switching language
  // re-renders it rather than leaving the previous language's text on screen.
  const [messageKey, setMessageKey] = useState<
    'location.denied' | 'location.failed' | 'location.unsupported' | null
  >(null);

  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (watchTimeout.current) {
      clearTimeout(watchTimeout.current);
      watchTimeout.current = null;
    }
  }, []);

  /**
   * Asks the device to keep reporting until the fix stops improving.
   *
   * A single `getCurrentPosition` returns whichever fix is ready first, and the
   * first fix is usually the worst one the device can produce — on a laptop
   * with no GPS radio that is an IP lookup, accurate to tens of kilometres.
   * Watching lets the reading tighten as the GPS or Wi-Fi scan resolves, which
   * is what a delivery or taxi app is doing while its pin visibly settles.
   *
   * `maximumAge: 0` refuses a cached position: a stale coarse fix from another
   * site would otherwise be handed over instantly and never improved on.
   */
  const requestGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('error');
      setMessageKey('location.unsupported');
      return;
    }

    stopWatching();
    bestAccuracy.current = Number.POSITIVE_INFINITY;
    setStatus('locating');
    setMessageKey(null);

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy ?? Number.POSITIVE_INFINITY;

        // Only accept a reading that beats the best so far.
        if (accuracy > bestAccuracy.current) return;
        bestAccuracy.current = accuracy;
        changeRef.current({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: Number.isFinite(accuracy) ? accuracy : null,
          source: 'GPS',
        });

        // Good enough to stand next to a tree with: stop, rather than holding
        // the radio open and draining the phone that is being carried around an
        // orchard.
        if (accuracy <= GOOD_ACCURACY_M) {
          stopWatching();
          setStatus('idle');
        }
      },
      (error) => {
        stopWatching();
        const denied = error.code === error.PERMISSION_DENIED;
        setStatus(denied ? 'denied' : 'error');
        setMessageKey(denied ? 'location.denied' : 'location.failed');
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );

    // Stop refining eventually whatever happens: a device that cannot do better
    // will keep reporting the same coarse fix indefinitely.
    watchTimeout.current = setTimeout(() => {
      stopWatching();
      setStatus('idle');
    }, WATCH_FOR_MS);
  }, [stopWatching]);

  // Ask on mount: standing in front of the tree is the common case, and making
  // the contributor tap a button first wastes the fix they already have.
  useEffect(() => {
    requestGps();
    return stopWatching;
  }, [requestGps, stopWatching]);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: publicConfig.mapStyleUrl,
      center: value ? [value.longitude, value.latitude] : publicConfig.mapDefaultCenter,
      zoom: value ? 17 : publicConfig.mapDefaultZoom,
    });
    map.current = instance;

    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');

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
    instance.on('click', (event: MapMouseEvent) => {
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
      const pin = new Marker({ draggable: true, color: '#1f4a2b' })
        .setLngLat(position)
        .addTo(instance);
      marker.current = pin;

      // Closing over `pin` rather than reading the ref: the ref is cleared on
      // unmount, and a drag that lands during teardown would otherwise throw.
      pin.on('dragend', () => {
        const lngLat = pin.getLngLat();
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
      (source as GeoJSONSource).setData({
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
          {status === 'locating' ? t('location.finding') : `📍 ${t('location.useMine')}`}
        </button>
        {value ? (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-stone-600">
            <span className="font-mono">
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </span>
            {value.accuracyM ? (
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  value.accuracyM <= GOOD_ACCURACY_M
                    ? 'bg-emerald-100 text-emerald-900'
                    : value.accuracyM <= POOR_ACCURACY_M
                      ? 'bg-stone-100 text-stone-600'
                      : 'bg-amber-100 text-amber-900'
                }`}
              >
                ±{formatAccuracy(value.accuracyM)}
              </span>
            ) : null}
            {status === 'locating' ? (
              <span className="text-xs text-stone-500">{t('location.improving')}</span>
            ) : null}
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs uppercase text-stone-500">
              {value.source}
            </span>
          </p>
        ) : (
          <p className="text-sm text-stone-500">{t('location.none')}</p>
        )}
      </div>

      {value?.accuracyM && value.accuracyM > POOR_ACCURACY_M && status !== 'locating' ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t('location.accuracyPoor', { accuracy: formatAccuracy(value.accuracyM) })}
        </p>
      ) : null}

      {messageKey ? (
        <p
          className={`rounded-lg border p-3 text-sm ${
            status === 'denied'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-stone-300 bg-stone-50 text-stone-700'
          }`}
        >
          {t(messageKey)}
        </p>
      ) : null}

      <div
        ref={container}
        className="h-64 w-full overflow-hidden rounded-xl border border-stone-300 sm:h-72"
        data-testid="location-map"
      />
      <p className="text-xs text-stone-500">{t('location.hint')}</p>
    </div>
  );
}
