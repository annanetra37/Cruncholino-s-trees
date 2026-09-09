/**
 * Armenia's administrative divisions (Q6: Armenia first).
 *
 * Geocoders do not agree on what to call a marz. The same province comes back
 * as "Shirak", "Shirak Province", "Shiraki Marz" or "Շիրակի մարզ" depending on
 * the provider, the `accept-language` header and the day. Left alone, the
 * region filter fills up with four spellings of one place and the counts are
 * wrong in a way nobody notices until someone asks why Shirak appears twice.
 *
 * So the geocoder's answer is mapped onto a canonical list here. The generic
 * `region` column is unchanged — this is normalisation at the edge, not a
 * schema commitment to one country. A tree recorded outside Armenia keeps
 * whatever the geocoder said.
 */

export type Marz = {
  slug: string;
  nameEn: string;
  nameHy: string;
  /** Yerevan is a city with marz-equivalent status, not a province. */
  isCity?: boolean;
};

export const ARMENIA_COUNTRY_CODE = 'AM';

export const MARZER: readonly Marz[] = [
  { slug: 'aragatsotn', nameEn: 'Aragatsotn', nameHy: 'Արագածոտն' },
  { slug: 'ararat', nameEn: 'Ararat', nameHy: 'Արարատ' },
  { slug: 'armavir', nameEn: 'Armavir', nameHy: 'Արմավիր' },
  { slug: 'gegharkunik', nameEn: 'Gegharkunik', nameHy: 'Գեղարքունիք' },
  { slug: 'kotayk', nameEn: 'Kotayk', nameHy: 'Կոտայք' },
  { slug: 'lori', nameEn: 'Lori', nameHy: 'Լոռի' },
  { slug: 'shirak', nameEn: 'Shirak', nameHy: 'Շիրակ' },
  { slug: 'syunik', nameEn: 'Syunik', nameHy: 'Սյունիք' },
  { slug: 'tavush', nameEn: 'Tavush', nameHy: 'Տավուշ' },
  { slug: 'vayots-dzor', nameEn: 'Vayots Dzor', nameHy: 'Վայոց ձոր' },
  { slug: 'yerevan', nameEn: 'Yerevan', nameHy: 'Երևան', isCity: true },
] as const;

/**
 * Spellings seen from Nominatim, Photon and MapTiler, plus the transliteration
 * variants that differ only in apostrophes and vowels. Anything not listed
 * still matches if it reduces to the canonical key after `simplify`.
 */
const ALIASES: Record<string, string> = {
  aragatsotn: 'aragatsotn',
  aragacotn: 'aragatsotn',
  արագածոտն: 'aragatsotn',
  ararat: 'ararat',
  արարատ: 'ararat',
  armavir: 'armavir',
  արմավիր: 'armavir',
  gegharkunik: 'gegharkunik',
  gegarkunik: 'gegharkunik',
  geharkunik: 'gegharkunik',
  գեղարքունիք: 'gegharkunik',
  kotayk: 'kotayk',
  kotayq: 'kotayk',
  կոտայք: 'kotayk',
  lori: 'lori',
  լոռի: 'lori',
  shirak: 'shirak',
  širak: 'shirak',
  շիրակ: 'shirak',
  syunik: 'syunik',
  syuniq: 'syunik',
  siunik: 'syunik',
  zangezur: 'syunik',
  սյունիք: 'syunik',
  tavush: 'tavush',
  tavus: 'tavush',
  տավուշ: 'tavush',
  vayotsdzor: 'vayots-dzor',
  vayotzdzor: 'vayots-dzor',
  vayocdzor: 'vayots-dzor',
  վայոցձոր: 'vayots-dzor',
  yerevan: 'yerevan',
  erevan: 'yerevan',
  jerevan: 'yerevan',
  երևան: 'yerevan',
  երեվան: 'yerevan',
};

const BY_SLUG = new Map(MARZER.map((marz) => [marz.slug, marz]));

/**
 * Reduces a place name to a comparison key: lowercase, no diacritics, no
 * punctuation, and without the words that mean "province" in any of the forms
 * a geocoder emits them.
 */
function simplify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    // Combining marks — but Armenian letters are not decomposed by NFD, so
    // this only strips Latin diacritics and leaves Armenian text intact.
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bprovince\b|\bregion\b|\bmarz[i]?\b|մարզ[իը]?/g, '')
    .replace(/[^\p{Letter}]/gu, '');
}

/**
 * "Shiraki marz" and "Շիրակի մարզ" put the province name in the genitive, so
 * removing the word "marz" leaves "shiraki" / "շիրակի" rather than the
 * nominative the alias table is keyed on. Both forms are tried.
 */
function candidateKeys(value: string): string[] {
  const key = simplify(value);
  if (!key) return [];
  const withoutGenitive = key.replace(/(i|ի)$/u, '');
  return withoutGenitive && withoutGenitive !== key ? [key, withoutGenitive] : [key];
}

/** Returns the canonical marz for a geocoder's region string, or null. */
export function matchMarz(value: string | null | undefined): Marz | null {
  if (!value) return null;

  for (const key of candidateKeys(value)) {
    const slug = ALIASES[key];
    if (slug) return BY_SLUG.get(slug) ?? null;

    // Fall back to matching the canonical names themselves, so a marz added to
    // MARZER without an alias entry still resolves.
    for (const marz of MARZER) {
      if (simplify(marz.nameEn) === key || simplify(marz.nameHy) === key) return marz;
    }
  }

  return null;
}

export function marzBySlug(slug: string): Marz | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Canonicalises a region name for a tree in Armenia. Outside Armenia the
 * geocoder's own answer is returned unchanged — this app starts with Armenia,
 * it does not refuse everywhere else.
 */
export function canonicalRegion(
  region: string | null,
  countryCode: string | null,
): string | null {
  if (countryCode && countryCode.toUpperCase() !== ARMENIA_COUNTRY_CODE) return region;
  return matchMarz(region)?.nameEn ?? region;
}

/** The Armenian name for a canonical region, for the bilingual UI. */
export function regionNameHy(region: string | null): string | null {
  return matchMarz(region)?.nameHy ?? null;
}
