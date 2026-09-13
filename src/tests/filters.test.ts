/** T10.1 — filter parsing and query building, without touching a database. */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseTreeFilters, filtersToSearchParams } from '@/lib/trees/filters';
import { buildTreeWhere } from '@/lib/trees/query';

const parse = (query: string) => parseTreeFilters(new URLSearchParams(query));

describe('parseTreeFilters', () => {
  it('treats repeated and comma-separated values the same way', () => {
    expect(parse('species=apple&species=pear').species).toEqual(['apple', 'pear']);
    expect(parse('species=apple,pear').species).toEqual(['apple', 'pear']);
    expect(parse('species[]=apple&species[]=pear').species).toEqual(['apple', 'pear']);
  });

  it('defaults to the first page of newest-first results', () => {
    const filters = parse('');
    expect(filters.page).toBe(1);
    expect(filters.sort).toBe('created_at:desc');
    expect(filters.species).toBeUndefined();
  });

  it('rejects an enum value it does not know', () => {
    expect(() => parse('condition=EXCELLENT')).toThrow(z.ZodError);
  });

  it('parses reachability like the other enum facets', () => {
    expect(parse('reachability=GROUND,LADDER').reachability).toEqual(['GROUND', 'LADDER']);
    expect(parse('').reachability).toBeUndefined();
    expect(() => parse('reachability=CLIMBABLE')).toThrow(z.ZodError);
  });

  it('parses a bbox in minLng,minLat,maxLng,maxLat order', () => {
    expect(parse('bbox=44.4,40.1,44.6,40.3').bbox).toEqual({
      minLng: 44.4,
      minLat: 40.1,
      maxLng: 44.6,
      maxLat: 40.3,
    });
  });

  it('rejects an inverted bbox rather than returning nothing', () => {
    // Silently returning an empty result set here sends the reader hunting for
    // a data problem that does not exist.
    expect(() => parse('bbox=44.6,40.1,44.4,40.3')).toThrow(z.ZodError);
  });

  it('rejects radius_m without near', () => {
    expect(() => parse('radius_m=500')).toThrow(z.ZodError);
    expect(parse('near=40.1,44.5&radius_m=500').radius_m).toBe(500);
  });

  it('rejects distance sorting without a point to measure from', () => {
    expect(() => parse('sort=distance:asc')).toThrow(z.ZodError);
  });

  it('caps page_size so one request cannot ask for the whole table', () => {
    expect(() => parse('page_size=100000')).toThrow(z.ZodError);
  });

  it('round-trips through a query string', () => {
    const params = filtersToSearchParams({ species: ['apple', 'pear'], city: 'Yerevan', q: '' });
    expect(params.get('species')).toBe('apple,pear');
    expect(params.get('city')).toBe('Yerevan');
    expect(params.has('q')).toBe(false);
  });
});

describe('buildTreeWhere', () => {
  it('always excludes soft-deleted rows', () => {
    expect(buildTreeWhere({}).sql).toContain('deleted_at IS NULL');
  });

  it('shows only published trees unless a status filter says otherwise', () => {
    expect(buildTreeWhere({}).sql).toContain("'PUBLISHED'");
    const withStatus = buildTreeWhere({ status: ['DRAFT', 'FLAGGED'] });
    expect(withStatus.values).toContain('DRAFT');
  });

  it('narrows on reachability, parameterised like every other enum', () => {
    const where = buildTreeWhere({ reachability: ['GROUND', 'LADDER'] });
    expect(where.sql).toContain('t.reachability::text IN');
    expect(where.values).toContain('GROUND');
    expect(where.values).toContain('LADDER');
    expect(where.sql).not.toContain('GROUND');
  });

  it('parameterises every filter value instead of interpolating it', () => {
    const where = buildTreeWhere({ city: "Yerevan'; DROP TABLE trees;--" });
    expect(where.sql).not.toContain('DROP TABLE');
    expect(where.values).toContain("Yerevan'; DROP TABLE trees;--");
  });

  it('uses a spatial predicate for bbox and radius', () => {
    expect(buildTreeWhere({ bbox: { minLng: 1, minLat: 2, maxLng: 3, maxLat: 4 } }).sql).toContain(
      'ST_Intersects',
    );
    expect(buildTreeWhere({ near: { lat: 40, lng: 44 }, radius_m: 100 }).sql).toContain(
      'ST_DWithin',
    );
  });

  it('ignores a radius with no point, rather than filtering to nothing', () => {
    expect(buildTreeWhere({ radius_m: 100 }).sql).not.toContain('ST_DWithin');
  });
});
