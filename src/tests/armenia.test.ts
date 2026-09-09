/** Q6 — canonicalising Armenia's marzer, so one province is one filter entry. */
import { describe, expect, it } from 'vitest';
import { canonicalRegion, matchMarz, marzBySlug, MARZER } from '@/lib/geocode/armenia';

describe('matchMarz', () => {
  it('matches the plain English name', () => {
    expect(matchMarz('Shirak')?.slug).toBe('shirak');
    expect(matchMarz('Kotayk')?.nameHy).toBe('Կոտայք');
  });

  it('strips the word a geocoder appends', () => {
    // These four are the same place, and without this they are four rows in
    // the region filter.
    expect(matchMarz('Shirak Province')?.slug).toBe('shirak');
    expect(matchMarz('Shirak Region')?.slug).toBe('shirak');
    expect(matchMarz('Shiraki Marz')?.slug).toBe('shirak');
    expect(matchMarz('Շիրակի մարզ')?.slug).toBe('shirak');
  });

  it('matches Armenian script', () => {
    expect(matchMarz('Սյունիք')?.slug).toBe('syunik');
    expect(matchMarz('Երևան')?.slug).toBe('yerevan');
  });

  it('tolerates transliteration variants', () => {
    expect(matchMarz("Syunik'")?.slug).toBe('syunik');
    expect(matchMarz('Vayots Dzor')?.slug).toBe('vayots-dzor');
    expect(matchMarz('Vayots’ Dzor')?.slug).toBe('vayots-dzor');
    expect(matchMarz('Erevan')?.slug).toBe('yerevan');
    expect(matchMarz('Gegarkunik')?.slug).toBe('gegharkunik');
  });

  it('returns null for somewhere else', () => {
    expect(matchMarz('Tbilisi')).toBeNull();
    expect(matchMarz('')).toBeNull();
    expect(matchMarz(null)).toBeNull();
    expect(matchMarz(undefined)).toBeNull();
  });

  it('covers all eleven divisions', () => {
    expect(MARZER).toHaveLength(11);
    expect(MARZER.every((marz) => marzBySlug(marz.slug)?.nameHy)).toBe(true);
    // Yerevan is a city with marz-equivalent status, and is marked as such.
    expect(MARZER.filter((marz) => marz.isCity).map((marz) => marz.slug)).toEqual(['yerevan']);
  });
});

describe('canonicalRegion', () => {
  it('canonicalises inside Armenia', () => {
    expect(canonicalRegion('Shirak Province', 'AM')).toBe('Shirak');
    expect(canonicalRegion('Շիրակի մարզ', 'am')).toBe('Shirak');
  });

  it('leaves a region outside Armenia exactly as the geocoder gave it', () => {
    // Armenia first does not mean Armenia only.
    expect(canonicalRegion('Kvemo Kartli', 'GE')).toBe('Kvemo Kartli');
    expect(canonicalRegion('Île-de-France', 'FR')).toBe('Île-de-France');
  });

  it('passes through an Armenian region it does not recognise', () => {
    expect(canonicalRegion('Somewhere new', 'AM')).toBe('Somewhere new');
  });

  it('handles a missing country code by attempting the match', () => {
    expect(canonicalRegion('Lori Province', null)).toBe('Lori');
  });

  it('keeps null null', () => {
    expect(canonicalRegion(null, 'AM')).toBeNull();
  });
});
