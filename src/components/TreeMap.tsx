'use client';

/**
 * T5.1 / T5.3 — the map.
 *
 * Features are loaded by viewport: on every `moveend` the current bounding box
 * is sent to the server and only what is visible comes back. The alternative —
 * loading every tree once and filtering in the browser — is fine at 200 trees
 * and unusable at 20,000.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
// MapLibre 6 dropped its default export; everything is a named export now.
import {
  GeolocateControl,
  MapLibreMap,
  NavigationControl,
  ScaleControl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type ErrorEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { publicConfig } from '@/lib/public-config';
import {
  initialMapStyle,
  isGlyphError,
  resolveMapStyle,
  type MapStyle,
} from '@/lib/client/map-style';
import { builtInMapStyle } from '@/lib/public-config';
import { markerIconExpression, registerMarkerImages } from '@/lib/client/markers';
import type { TreeFeatureCollection } from '@/lib/client/types';
import { useT } from '@/i18n/client';

const SOURCE_ID = 'trees';
const MARKER_LAYER = 'tree-markers';
const CLUSTER_LAYER = 'tree-clusters';
const CLUSTER_COUNT_LAYER = 'tree-cluster-counts';

const SELECTED_LAYER = 'tree-selected';

function applySelection(instance: MapLibreMap, selectedId: string | null | undefined) {
  if (instance.getLayer(SELECTED_LAYER)) instance.removeLayer(SELECTED_LAYER);
  if (!selectedId || !instance.getSource(SOURCE_ID)) return;

  instance.addLayer({
    id: SELECTED_LAYER,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'id'], selectedId],
    paint: {
      'circle-radius': 18,
      'circle-color': 'transparent',
      'circle-stroke-color': '#1f4a2b',
      'circle-stroke-width': 3,
    },
  });
}

export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number; zoom: number };

type Props = {
  data: TreeFeatureCollection;
  onViewportChange: (bbox: Bbox) => void;
  onSelect: (treeId: string) => void;
  selectedId?: string | null;
  /** Recentres the map, e.g. after picking a city filter. */
  flyTo?: { longitude: number; latitude: number; zoom?: number } | null;
};

export function TreeMap({ data, onViewportChange, onSelect, selectedId, flyTo }: Props) {
  const t = useT();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  // `null` while a configured provider style is being probed; see map-style.ts.
  const [style, setStyle] = useState<MapStyle | null>(initialMapStyle);

  // Kept in a ref so the map's event handlers never close over a stale prop.
  const latestData = useRef(data);
  latestData.current = data;
  // One fallback only: if the built-in style fails too, the error is real.
  const usingFallback = useRef(false);
  const latestSelection = useRef(selectedId);
  latestSelection.current = selectedId;
  const viewportCallback = useRef(onViewportChange);
  viewportCallback.current = onViewportChange;
  const selectCallback = useRef(onSelect);
  selectCallback.current = onSelect;

  const emitViewport = useCallback(() => {
    const instance = map.current;
    if (!instance) return;
    const bounds = instance.getBounds();
    viewportCallback.current({
      minLng: bounds.getWest(),
      minLat: bounds.getSouth(),
      maxLng: bounds.getEast(),
      maxLat: bounds.getNorth(),
      zoom: instance.getZoom(),
    });
  }, []);

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
      center: publicConfig.mapDefaultCenter,
      zoom: publicConfig.mapDefaultZoom,
      attributionControl: { compact: true },
    });

    map.current = instance;
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    instance.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
      'top-right',
    );
    instance.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    instance.on('error', (event: ErrorEvent) => {
      // MapLibre reports load failures here and nowhere else — it draws an
      // empty background and carries on, which is why a broken basemap looks
      // like a broken app rather than an error.
      const message = event.error?.message ?? 'Map failed to load';
      if (isGlyphError(message)) return;

      // A provider style whose *tiles* are rejected is the case the pre-flight
      // probe cannot see: style.json returns 200, the map loads, and then every
      // tile 403s. Falling back here catches that, and any later outage too.
      if (typeof style === 'string' && !usingFallback.current) {
        usingFallback.current = true;
        instance.setStyle(builtInMapStyle);
        return;
      }

      setStyleError((current) => current ?? message);
    });

    // `style.load` rather than `load`: it fires for the initial style *and*
    // again after `setStyle`, so the fallback above comes back with its layers.
    instance.on('style.load', () => {
      registerMarkerImages(instance);

      instance.addSource(SOURCE_ID, { type: 'geojson', data: latestData.current as never });

      instance.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', ['get', 'cluster'], true],
        paint: {
          'circle-color': '#1f4a2b',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'point_count'],
            1,
            14,
            50,
            22,
            500,
            30,
            5000,
            40,
          ],
        },
      });

      instance.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['==', ['get', 'cluster'], true],
        layout: {
          'text-field': ['to-string', ['get', 'point_count']],
          'text-size': 13,
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' },
      });

      instance.addLayer({
        id: MARKER_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['!=', ['get', 'cluster'], true],
        layout: {
          'icon-image': markerIconExpression() as never,
          'icon-allow-overlap': true,
          'icon-size': ['match', ['get', 'ageBand'], 'YOUNG', 0.5, 'MID', 0.68, 'OLD', 0.9, 0.58],
        },
      });

      applySelection(instance, latestSelection.current);

      setReady(true);
      emitViewport();
    });

    // Registered once, outside `style.load`: layer-scoped handlers survive a
    // restyle, and re-registering them would fire each one twice per click.
    const pointer = (value: string) => () => {
      instance.getCanvas().style.cursor = value;
    };
    instance.on('mouseenter', MARKER_LAYER, pointer('pointer'));
    instance.on('mouseleave', MARKER_LAYER, pointer(''));
    instance.on('mouseenter', CLUSTER_LAYER, pointer('zoom-in'));
    instance.on('mouseleave', CLUSTER_LAYER, pointer(''));

    instance.on('click', MARKER_LAYER, (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === 'string') selectCallback.current(id);
    });

    // T5.3 — clicking a cluster zooms into it.
    instance.on('click', CLUSTER_LAYER, (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const [longitude, latitude] = feature.geometry.coordinates as [number, number];
      instance.easeTo({ center: [longitude, latitude], zoom: instance.getZoom() + 2.5 });
    });

    // Debounced: dragging the map fires moveend once, but a pinch-zoom on a
    // phone can fire several in quick succession.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMoveEnd = () => {
      clearTimeout(timer);
      timer = setTimeout(emitViewport, 250);
    };
    instance.on('moveend', onMoveEnd);

    return () => {
      clearTimeout(timer);
      instance.remove();
      map.current = null;
    };
  }, [emitViewport, style]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const source = map.current.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(data as never);
  }, [data, ready]);

  useEffect(() => {
    if (!ready || !map.current || !flyTo) return;
    map.current.flyTo({
      center: [flyTo.longitude, flyTo.latitude],
      zoom: flyTo.zoom ?? 14,
      essential: true,
    });
  }, [flyTo, ready]);

  // A ring around the selected marker, so the map and the detail panel agree.
  useEffect(() => {
    if (!ready || !map.current) return;
    applySelection(map.current, selectedId);
  }, [selectedId, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" data-testid="tree-map" />
      {styleError ? (
        <div className="absolute inset-x-4 top-4 z-10 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {/^(401|403)|forbidden|unauthor|key/i.test(styleError)
            ? t('map.keyRejected', { error: styleError })
            : t('map.styleFailed', { error: styleError })}
        </div>
      ) : null}
    </div>
  );
}
