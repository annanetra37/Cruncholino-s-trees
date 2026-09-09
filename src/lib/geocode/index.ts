/**
 * T3.7 — reverse geocoding with a coordinate cache.
 *
 * Trees on the same street should not cost forty provider calls, so lookups are
 * keyed by the coordinate rounded to four decimal places — about 11 m, which is
 * finer than the GPS accuracy of the phone that produced it.
 */
import { GeocodeStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { reverseGeocode } from '@/lib/geocode/provider';
import { EMPTY_ADDRESS, type NormalisedAddress } from '@/lib/geocode/normalise';

export const CACHE_PRECISION = 4;

/** Pure, and therefore unit-testable without a database (T10.1). */
export function cacheKey(latitude: number, longitude: number): string {
  const round = (value: number) => value.toFixed(CACHE_PRECISION);
  // `-0` and `0` must not produce two different keys.
  return `${round(latitude + 0)},${round(longitude + 0)}`;
}

export type GeocodeResult = {
  address: NormalisedAddress;
  raw: Prisma.InputJsonValue | undefined;
  status: GeocodeStatus;
  cached: boolean;
};

const FAILED: GeocodeResult = {
  address: EMPTY_ADDRESS,
  raw: undefined,
  status: GeocodeStatus.FAILED,
  cached: false,
};

export async function resolveAddress(
  latitude: number,
  longitude: number,
): Promise<GeocodeResult> {
  const key = cacheKey(latitude, longitude);

  const cached = await prisma.geocodeCache.findUnique({ where: { key } });
  if (cached) {
    return {
      address: {
        addressLine: cached.addressLine,
        city: cached.city,
        district: cached.district,
        region: cached.region,
        country: cached.country,
        countryCode: cached.countryCode,
        postalCode: cached.postalCode,
      },
      raw: cached.payload as Prisma.InputJsonValue,
      status: GeocodeStatus.OK,
      cached: true,
    };
  }

  const lookup = await reverseGeocode(latitude, longitude);
  if (!lookup) return FAILED;

  const payload = (lookup.raw ?? {}) as Prisma.InputJsonValue;

  try {
    await prisma.geocodeCache.upsert({
      where: { key },
      create: {
        key,
        latitude,
        longitude,
        provider: lookup.provider,
        payload,
        ...lookup.address,
      },
      update: { payload, provider: lookup.provider, ...lookup.address },
    });
  } catch (error) {
    // A cache write failure must not lose a successful lookup.
    logger.warn('geocode cache write failed', { key, error });
  }

  return { address: lookup.address, raw: payload, status: GeocodeStatus.OK, cached: false };
}
