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
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { publicConfig } from '@/lib/public-config';
import { markerIconExpression, registerMarkerImages } from '@/lib/client/markers';
import type { TreeFeatureCollection } from '@/lib/client/types';

const SOURCE_ID = 'trees';
const MARKER_LAYER = 'tree-markers';
const CLUSTER_LAYER = 'tree-clusters';
const CLUSTER_COUNT_LAYER = 'tree-cluster-counts';

const EMPTY: TreeFeatureCollection = {
  type: 'FeatureCollection',
  clustered: false,
  total: 0,
  features: [],
};

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
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);

  // Kept in a ref so the map's event handlers never close over a stale prop.
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
    if (!container.current || map.current) return;

    const instance = new maplibregl.Map({
      container: container.current,
      style: publicConfig.mapStyleUrl,
      center: publicConfig.mapDefaultCenter,
      zoom: publicConfig.mapDefaultZoom,
      attributionControl: { compact: true },
    });

    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    instance.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
      'top-right',
    );
    instance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    instance.on('error', (event) => {
      // A missing tile key is the single most common map failure and it is
      // silent by default; surface it rather than showing an empty grey box.
      const message = event.error?.message ?? 'Map failed to load';
      if (message.toLowerCase().includes('style')) setStyleError(message);
    });

    instance.on('load', () => {
      registerMarkerImages(instance);

      instance.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY });

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
          'icon-size': [
            'match',
            ['get', 'ageBand'],
            'YOUNG',
            0.5,
            'MID',
            0.68,
            'OLD',
            0.9,
            0.58,
          ],
        },
      });

      const pointer = (value: string) => () => {
        instance.getCanvas().style.cursor = value;
      };
      instance.on('mouseenter', MARKER_LAYER, pointer('pointer'));
      instance.on('mouseleave', MARKER_LAYER, pointer(''));
      instance.on('mouseenter', CLUSTER_LAYER, pointer('zoom-in'));
      instance.on('mouseleave', CLUSTER_LAYER, pointer(''));

      instance.on('click', MARKER_LAYER, (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === 'string') selectCallback.current(id);
      });

      // T5.3 — clicking a cluster zooms into it.
      instance.on('click', CLUSTER_LAYER, (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') return;
        const [longitude, latitude] = feature.geometry.coordinates as [number, number];
        instance.easeTo({ center: [longitude, latitude], zoom: instance.getZoom() + 2.5 });
      });

      setReady(true);
      emitViewport();
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
  }, [emitViewport]);

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
    const instance = map.current;
    const layerId = 'tree-selected';

    if (instance.getLayer(layerId)) instance.removeLayer(layerId);
    if (!selectedId) return;

    instance.addLayer({
      id: layerId,
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
  }, [selectedId, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" data-testid="tree-map" />
      {styleError ? (
        <div className="absolute inset-x-4 top-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          The base map failed to load ({styleError}). Check{' '}
          <code className="font-mono">NEXT_PUBLIC_MAP_STYLE_URL</code> and the tile key.
        </div>
      ) : null}
    </div>
  );
}
