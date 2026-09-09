/** T10.1 — geocode normalisation and the coordinate cache key. */
import { describe, expect, it } from 'vitest';
import { cacheKey } from '@/lib/geocode';
import {
  normaliseMapTiler,
  normaliseNominatim,
  normalisePhoton,
} from '@/lib/geocode/normalise';

describe('cacheKey', () => {
  it('rounds to ~11 m so a street costs one lookup, not forty', () => {
    expect(cacheKey(40.187234, 44.515678)).toBe('40.1872,44.5157');
    // 3 m apart — the same key, which is the entire point.
    expect(cacheKey(40.18721, 44.51567)).toBe(cacheKey(40.18723, 44.51568));
  });

  it('does not produce two keys for zero', () => {
    expect(cacheKey(-0, -0)).toBe(cacheKey(0, 0));
  });

  it('keeps genuinely different places apart', () => {
    expect(cacheKey(40.1872, 44.5152)).not.toBe(cacheKey(40.7894, 43.8475));
  });
});

describe('normaliseNominatim', () => {
  it('reads a village as the city, not just a "city" key', () => {
    // A rural tree comes back with `village`; treating only `city` as the city
    // would leave most of the dataset unfilterable.
    const result = normaliseNominatim({
      display_name: 'Ashtarak, Aragatsotn, Armenia',
      address: { village: 'Ohanavan', state: 'Aragatsotn', country: 'Armenia', country_code: 'am' },
    });
    expect(result.city).toBe('Ohanavan');
    expect(result.region).toBe('Aragatsotn');
    expect(result.countryCode).toBe('AM');
  });

  it('joins road and house number into an address line', () => {
    const result = normaliseNominatim({
      address: { road: 'Mashtots Avenue', house_number: '12', city: 'Yerevan' },
    });
    expect(result.addressLine).toBe('Mashtots Avenue 12');
  });

  it('falls back to display_name when there is no street', () => {
    const result = normaliseNominatim({ display_name: 'Somewhere', address: {} });
    expect(result.addressLine).toBe('Somewhere');
  });

  it('canonicalises the marz it returns', () => {
    const result = normaliseNominatim({
      address: { village: 'Panik', state: 'Shirak Province', country_code: 'am' },
    });
    expect(result.region).toBe('Shirak');
  });

  it('survives junk without throwing', () => {
    expect(normaliseNominatim(null).city).toBeNull();
    expect(normaliseNominatim('nonsense').city).toBeNull();
    expect(normaliseNominatim({}).city).toBeNull();
  });
});

describe('normaliseMapTiler', () => {
  it('pulls administrative levels out of the context array', () => {
    const result = normaliseMapTiler({
      features: [
        {
          place_name: 'Mashtots Ave, Yerevan',
          text: 'Mashtots Ave',
          properties: { country_code: 'am' },
          context: [
            { id: 'municipality.1', text: 'Yerevan' },
            { id: 'region.2', text: 'Yerevan' },
            { id: 'country.3', text: 'Armenia' },
            { id: 'postal_code.4', text: '0015' },
          ],
        },
      ],
    });
    expect(result.city).toBe('Yerevan');
    expect(result.country).toBe('Armenia');
    expect(result.postalCode).toBe('0015');
    expect(result.countryCode).toBe('AM');
  });

  it('returns empty for a response with no features', () => {
    expect(normaliseMapTiler({ features: [] }).city).toBeNull();
  });
});

describe('normalisePhoton', () => {
  it('reads the free keyless provider’s response', () => {
    const result = normalisePhoton({
      features: [
        {
          properties: {
            name: 'Abovyan Street',
            street: 'Abovyan Street',
            housenumber: '14',
            city: 'Yerevan',
            state: 'Yerevan',
            country: 'Armenia',
            countrycode: 'am',
            postcode: '0009',
          },
        },
      ],
    });
    expect(result.addressLine).toBe('Abovyan Street 14');
    expect(result.city).toBe('Yerevan');
    expect(result.countryCode).toBe('AM');
    expect(result.postalCode).toBe('0009');
  });

  it('canonicalises the marz like every other provider', () => {
    const result = normalisePhoton({
      features: [{ properties: { name: 'Somewhere', state: 'Shirak Province', countrycode: 'am' } }],
    });
    expect(result.region).toBe('Shirak');
  });

  it('survives an empty or malformed response', () => {
    expect(normalisePhoton({ features: [] }).city).toBeNull();
    expect(normalisePhoton(null).city).toBeNull();
    expect(normalisePhoton('nope').city).toBeNull();
  });
});
