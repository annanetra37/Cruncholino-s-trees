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
  type ErrorEvent,
  type GeoJSONSourceSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { builtInMapStyle, publicConfig } from '@/lib/public-config';
import {
  initialMapStyle,
  isGlyphError,
  resolveMapStyle,
  type MapStyle,
} from '@/lib/client/map-style';
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

/** The accuracy circle's data for a reading, or nothing when there is none. */
function accuracyData(
  reading: { latitude: number; longitude: number; accuracyM: number | null } | null | undefined,
): Exclude<GeoJSONSourceSpecification['data'], string> {
  if (!reading?.accuracyM) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [reading.longitude, reading.latitude] },
        properties: { accuracy: reading.accuracyM },
      },
    ],
  };
}

type PlaceResult = {
  label: string;
  latitude: number;
  longitude: number;
};

/**
 * Reads a typed pair of coordinates, or returns null if the text is not one.
 *
 * Accepts what people actually paste: "40.18726, 44.51520", the same with a
 * space or a semicolon, and the degree signs that come off a phone's share
 * sheet. Anything else is treated as an address to search for, so this has to
 * be strict about what it claims — a half-parsed "Abovyan 12" placing a pin in
 * the Gulf of Guinea is worse than no answer.
 */
export function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const cleaned = text.replace(/[°\s]+/g, ' ').trim();
  const match = /^(-?\d{1,3}(?:\.\d+)?)\s*[,;]?\s+(-?\d{1,3}(?:\.\d+)?)$/.exec(cleaned);
  if (!match) return null;

  const latitude = Number.parseFloat(match[1] as string);
  const longitude = Number.parseFloat(match[2] as string);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { latitude, longitude };
}

export function LocationStep({ value, onChange }: Props) {
  const t = useT();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'error'>('idle');
  // `null` while a configured provider style is being probed; see map-style.ts.
  const [style, setStyle] = useState<MapStyle | null>(initialMapStyle);
  const [address, setAddress] = useState<string | null>(null);
  const [addressState, setAddressState] = useState<'idle' | 'looking' | 'found' | 'none'>('idle');
  const [mapError, setMapError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searchError, setSearchError] = useState<'none' | 'failed' | null>(null);
  // One fallback only: if the built-in style fails too, the error is real.
  const usingFallback = useRef(false);
  const latestValue = useRef(value);
  latestValue.current = value;
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
    if (style) return;
    let live = true;
    void resolveMapStyle().then((resolved) => {
      if (live) setStyle(resolved);
    });
    return () => {
      live = false;
    };
  }, [style]);

  useEffect(() => {
    if (!container.current || map.current || !style) return;

    const instance = new MapLibreMap({
      container: container.current,
      style,
      center: value ? [value.longitude, value.latitude] : publicConfig.mapDefaultCenter,
      zoom: value ? 17 : publicConfig.mapDefaultZoom,
    });
    map.current = instance;

    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    instance.on('error', (event: ErrorEvent) => {
      // This map had no error handling at all, so a basemap that failed to
      // paint looked like a bug in the form rather than a map that could not
      // load. A provider style whose *tiles* are rejected is the case the
      // pre-flight probe cannot see: style.json returns 200, the map loads,
      // and then every tile 403s.
      const message = event.error?.message ?? 'Map failed to load';
      if (isGlyphError(message)) return;

      if (typeof style === 'string' && !usingFallback.current) {
        usingFallback.current = true;
        instance.setStyle(builtInMapStyle);
        return;
      }
      setMapError((current) => current ?? message);
    });

    // `style.load` rather than `load`: it fires for the initial style *and*
    // again after `setStyle`, so the fallback above comes back with its layer.
    instance.on('style.load', () => {
      instance.addSource('accuracy', {
        type: 'geojson',
        data: accuracyData(latestValue.current),
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
    // Otherwise mount-only: `value` is applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

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
      (source as GeoJSONSource).setData(accuracyData(value));
    }
  }, [value]);

  // Show the address the save will record, while the contributor can still
  // correct the pin. Debounced because dragging fires a change per frame, and
  // keyed on coordinates rounded to the geocode cache's precision so that a
  // refined accuracy reading at the same spot does not spend another lookup.
  const lat = value ? Number(value.latitude.toFixed(5)) : null;
  const lng = value ? Number(value.longitude.toFixed(5)) : null;

  useEffect(() => {
    if (lat === null || lng === null) {
      setAddress(null);
      setAddressState('idle');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setAddressState('looking');
      fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { address?: { addressLine: string | null } | null } | null) => {
          const line = body?.address?.addressLine ?? null;
          setAddress(line);
          setAddressState(line ? 'found' : 'none');
        })
        .catch(() => {
          // An aborted request is the common case here — the pin moved again.
          if (controller.signal.aborted) return;
          setAddress(null);
          setAddressState('none');
        });
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lng]);

  const moveTo = useCallback(
    (latitude: number, longitude: number) => {
      // Typed or picked, the position is the contributor's own claim rather
      // than a measurement, so it carries no accuracy — showing a radius here
      // would invent a precision nobody asserted.
      onChange({ latitude, longitude, accuracyM: null, source: 'MANUAL' });
      setResults(null);
      setSearchError(null);
    },
    [onChange],
  );

  const runSearch = useCallback(async () => {
    const text = search.trim();
    if (!text) return;

    // Coordinates need no lookup: they are already a point. This also means
    // typing a pair still works when the geocoder is unreachable.
    const typed = parseCoordinates(text);
    if (typed) {
      moveTo(typed.latitude, typed.longitude);
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(text)}`);
      const body = response.ok ? ((await response.json()) as { results: PlaceResult[] }) : null;
      const found = body?.results ?? [];
      setResults(found);
      setSearchError(found.length ? null : 'none');
    } catch {
      setResults(null);
      setSearchError('failed');
    } finally {
      setSearching(false);
    }
  }, [moveTo, search]);

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

      {addressState === 'idle' ? null : (
        <p
          className={
            addressState === 'found'
              ? 'text-sm font-medium text-stone-800'
              : 'text-sm text-stone-500'
          }
          data-testid="location-address"
        >
          {addressState === 'found'
            ? `\u{1F4CD} ${address}`
            : addressState === 'looking'
              ? t('location.addressLooking')
              : t('location.addressUnknown')}
        </p>
      )}

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

      {/* The third way in, after GPS and tapping the map: say where it is.
          One field rather than two, because a pasted "40.18726, 44.51520" and
          a typed street name are the same intent — put the pin there. */}
      <div className="space-y-2">
        <label className="block">
          <span className="field-label">{t('location.searchLabel')}</span>
          <div className="flex gap-2">
            <input
              type="text"
              className="field-input"
              value={search}
              placeholder={t('location.searchPlaceholder')}
              data-testid="location-search"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                // Inside a form, Enter would submit the whole tree.
                if (event.key !== 'Enter') return;
                event.preventDefault();
                void runSearch();
              }}
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              disabled={searching || search.trim().length === 0}
              onClick={() => void runSearch()}
            >
              {searching ? t('location.searching') : t('common.search')}
            </button>
          </div>
        </label>

        {results?.length ? (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-300">
            {results.map((place) => (
              <li key={`${place.latitude},${place.longitude},${place.label}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
                  onClick={() => moveTo(place.latitude, place.longitude)}
                >
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {searchError ? (
          <p className="text-sm text-stone-500">
            {searchError === 'none' ? t('location.searchNone') : t('location.searchFailed')}
          </p>
        ) : null}
      </div>

      {mapError ? (
        <p
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          data-testid="location-map-error"
        >
          {t('map.styleFailed', { error: mapError })}
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
