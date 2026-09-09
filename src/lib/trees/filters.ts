/**
 * T3.2 — the filter contract, shared by the list endpoint, the GeoJSON
 * endpoint, the stats endpoint and the export. Parsing lives in one place so
 * "the same filters" is a fact about the code rather than a promise in a
 * document.
 */
import { AgeBand, Condition, FruitQuality, TreeStatus } from '@prisma/client';
import { z } from 'zod';
import { env } from '@/env';

/** `?species=a&species=b` and `?species=a,b` should mean the same thing. */
function multi<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    const list = Array.isArray(value) ? value : [value];
    const flat = list
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter(Boolean);
    return flat.length ? flat : undefined;
  }, z.array(item).optional());
}

const bboxSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const parts = value.split(',').map((part) => Number.parseFloat(part.trim()));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      ctx.addIssue({ code: 'custom', message: 'bbox must be minLng,minLat,maxLng,maxLat' });
      return z.NEVER;
    }
    const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
    if (minLat > maxLat || minLng > maxLng) {
      ctx.addIssue({ code: 'custom', message: 'bbox minimums must not exceed maximums' });
      return z.NEVER;
    }
    return { minLng, minLat, maxLng, maxLat };
  });

const nearSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const parts = value.split(',').map((part) => Number.parseFloat(part.trim()));
    if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) {
      ctx.addIssue({ code: 'custom', message: 'near must be lat,lng' });
      return z.NEVER;
    }
    const [lat, lng] = parts as [number, number];
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      ctx.addIssue({ code: 'custom', message: 'near must be a valid coordinate' });
      return z.NEVER;
    }
    return { lat, lng };
  });

export const SORT_OPTIONS = [
  'created_at:desc',
  'created_at:asc',
  'updated_at:desc',
  'species:asc',
  'condition:asc',
  'city:asc',
  'distance:asc',
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

export const treeFilterSchema = z.object({
  species: multi(z.string().min(1)),
  age_band: multi(z.enum(AgeBand)),
  condition: multi(z.enum(Condition)),
  fruit_quality: multi(z.enum(FruitQuality)),
  status: multi(z.enum(TreeStatus)),
  city: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  country_code: z.string().trim().length(2).optional(),
  bbox: bboxSchema,
  near: nearSchema,
  radius_m: z.coerce.number().positive().max(100_000).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  created_by: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(50),
  sort: z.enum(SORT_OPTIONS).default('created_at:desc'),
});

export type TreeFilters = z.infer<typeof treeFilterSchema>;

/**
 * `radius_m` without `near` is a request the caller did not mean; silently
 * ignoring half of it would return a wildly larger result set than expected.
 */
export function parseTreeFilters(searchParams: URLSearchParams): TreeFilters {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    raw[key.replace(/\[\]$/, '')] = values.length > 1 ? values : values[0]!;
  }

  const filters = treeFilterSchema.parse(raw);

  if (filters.radius_m !== undefined && !filters.near) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['near'],
        message: 'radius_m requires near=lat,lng',
      },
    ]);
  }

  if (filters.sort === 'distance:asc' && !filters.near) {
    throw new z.ZodError([
      { code: 'custom', path: ['sort'], message: 'sort=distance:asc requires near=lat,lng' },
    ]);
  }

  return filters;
}

/** Round-trips filters back into a query string (used by the UI and export links). */
export function filtersToSearchParams(filters: Partial<Record<string, unknown>>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}
