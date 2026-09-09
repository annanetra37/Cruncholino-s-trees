/**
 * The outbound half of reverse geocoding: one HTTP call, a timeout, a single
 * retry, and a throttle that keeps the app inside the provider's terms.
 *
 * This module is never imported by client code — that is what keeps
 * GEOCODING_API_KEY out of the browser bundle (T3.7, T10.8).
 */
import { env } from '@/env';
import { logger } from '@/lib/logger';
import {
  normaliseMapTiler,
  normaliseNominatim,
  normalisePhoton,
  type NormalisedAddress,
} from '@/lib/geocode/normalise';

export type GeocodeLookup = {
  address: NormalisedAddress;
  raw: unknown;
  provider: string;
};

/**
 * Nominatim's usage policy caps requests at one per second and there is no
 * queue in front of us, so serialise outbound calls through a promise chain.
 * With a paid provider set GEOCODING_MIN_INTERVAL_MS=0 and this becomes a
 * no-op.
 */
let throttleChain: Promise<void> = Promise.resolve();

function throttle(): Promise<void> {
  if (env.GEOCODING_MIN_INTERVAL_MS <= 0) return Promise.resolve();
  const wait = throttleChain;
  throttleChain = wait.then(
    () => new Promise((resolve) => setTimeout(resolve, env.GEOCODING_MIN_INTERVAL_MS)),
  );
  return wait;
}

function buildUrl(latitude: number, longitude: number): string | null {
  switch (env.GEOCODING_PROVIDER) {
    case 'nominatim': {
      const base = env.GEOCODING_BASE_URL ?? 'https://nominatim.openstreetmap.org/reverse';
      const url = new URL(base);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('zoom', '18');
      url.searchParams.set('addressdetails', '1');
      // One language for stored addresses, so the same street does not arrive
      // transliterated differently on different days. The interface is
      // bilingual through its own message catalogue, not through whatever the
      // geocoder happened to return.
      url.searchParams.set('accept-language', 'en');
      return url.toString();
    }
    case 'photon': {
      const base = env.GEOCODING_BASE_URL ?? 'https://photon.komoot.io/reverse';
      const url = new URL(base);
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('lang', 'en');
      return url.toString();
    }
    case 'maptiler': {
      const base = env.GEOCODING_BASE_URL ?? 'https://api.maptiler.com/geocoding';
      const url = new URL(`${base.replace(/\/$/, '')}/${longitude},${latitude}.json`);
      if (env.GEOCODING_API_KEY) url.searchParams.set('key', env.GEOCODING_API_KEY);
      return url.toString();
    }
    default:
      return null;
  }
}

function normalise(payload: unknown): NormalisedAddress {
  switch (env.GEOCODING_PROVIDER) {
    case 'maptiler':
      return normaliseMapTiler(payload);
    case 'photon':
      return normalisePhoton(payload);
    default:
      return normaliseNominatim(payload);
  }
}

async function fetchOnce(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.GEOCODING_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim rejects requests without an identifying User-Agent.
        'user-agent': env.GEOCODING_USER_AGENT,
        accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Geocoding provider returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns null rather than throwing: a failed geocode is an expected outcome,
 * not an exception. Coordinates are the source of truth; the address is a
 * convenience, and creating a tree must never depend on it.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodeLookup | null> {
  const url = buildUrl(latitude, longitude);
  if (!url) return null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await throttle();
      const payload = await fetchOnce(url);
      return { address: normalise(payload), raw: payload, provider: env.GEOCODING_PROVIDER };
    } catch (error) {
      const lastAttempt = attempt === 1;
      // The message, not the Error: a provider timeout or 403 is an expected
      // outcome here, and its stack is the same three frames every time. Two
      // stack traces per tree would drown the log this is meant to explain.
      logger.warn('reverse geocode attempt failed', {
        attempt: attempt + 1,
        latitude,
        longitude,
        provider: env.GEOCODING_PROVIDER,
        reason: error instanceof Error ? error.message : String(error),
      });
      if (lastAttempt) return null;
    }
  }

  return null;
}
