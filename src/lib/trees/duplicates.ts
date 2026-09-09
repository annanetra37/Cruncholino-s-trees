/**
 * T3.9 — duplicate detection.
 *
 * A soft warning, never a hard block. Orchards genuinely have trees four
 * metres apart, and a contributor standing in one should not be told their
 * observation is wrong.
 */
import { prisma } from '@/lib/prisma';
import { env } from '@/env';

export type NearbyTree = {
  id: string;
  distance_m: number;
  species_name_en: string;
  condition: string;
  created_at: Date;
};

export async function findNearbyDuplicates(params: {
  latitude: number;
  longitude: number;
  speciesId: string;
  radiusM?: number;
  excludeTreeId?: string;
}): Promise<NearbyTree[]> {
  const radius = params.radiusM ?? env.DUPLICATE_RADIUS_M;
  const exclude = params.excludeTreeId ?? '00000000-0000-0000-0000-000000000000';

  return prisma.$queryRaw<NearbyTree[]>`
    SELECT
      t.id,
      ST_Distance(
        t.geom,
        ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)::geography
      ) AS distance_m,
      s.name_en AS species_name_en,
      t.condition::text AS condition,
      t.created_at
    FROM trees t
    JOIN species s ON s.id = t.species_id
    WHERE t.deleted_at IS NULL
      AND t.species_id = ${params.speciesId}::uuid
      AND t.id <> ${exclude}::uuid
      AND ST_DWithin(
        t.geom,
        ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)::geography,
        ${radius}
      )
    ORDER BY distance_m ASC
    LIMIT 5
  `;
}
