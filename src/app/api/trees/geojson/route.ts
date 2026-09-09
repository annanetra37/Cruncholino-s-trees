/**
 * T3.3 — the map layer.
 *
 * Below the feature cap this returns points. Above it, it returns clusters
 * computed in Postgres, because shipping 50,000 features to a phone so that
 * MapLibre can immediately collapse them into forty circles is a waste of the
 * user's data plan and their battery.
 */
import { z } from 'zod';
import { env } from '@/env';
import { json, route } from '@/lib/api';
import { requireReadAccess, shouldFuzzCoordinates } from '@/lib/authz';
import { parseTreeFilters } from '@/lib/trees/filters';
import { clusterTrees, countTrees, findTreesForMap } from '@/lib/trees/query';
import { toFeature } from '@/lib/trees/serialise';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cluster grid size in degrees, derived from the viewport zoom so that a
 * cluster is roughly a fixed number of pixels across at any scale.
 */
function gridForZoom(zoom: number): number {
  return 360 / 2 ** Math.max(0, Math.min(zoom, 20)) / 2;
}

export const GET = route('trees.geojson', async (request) => {
  const url = new URL(request.url);
  const user = await requireReadAccess();
  const filters = parseTreeFilters(url.searchParams);
  const zoom = z.coerce.number().min(0).max(24).default(11).parse(url.searchParams.get('zoom') ?? 11);

  const total = await countTrees(filters);

  if (total > env.MAX_GEOJSON_FEATURES) {
    const clusters = await clusterTrees(filters, gridForZoom(zoom));
    return json({
      type: 'FeatureCollection' as const,
      clustered: true,
      total,
      features: clusters.map((cluster, index) => ({
        type: 'Feature' as const,
        id: `cluster-${index}`,
        geometry: { type: 'Point' as const, coordinates: [cluster.longitude, cluster.latitude] },
        properties: { cluster: true, point_count: cluster.count },
      })),
    });
  }

  const rows = await findTreesForMap(filters, env.MAX_GEOJSON_FEATURES);
  const fuzz = shouldFuzzCoordinates(user);

  return json({
    type: 'FeatureCollection' as const,
    clustered: false,
    total,
    features: rows.map((row) => toFeature(row, { fuzz })),
  });
});
