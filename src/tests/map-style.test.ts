import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The basemap has been the single most fragile piece of configuration in this
 * app: a key that is wrong, expired or domain-restricted produces a blank map
 * and no error a contributor can act on. These cover the fallback that keeps
 * that from happening.
 */
async function load(styleUrl?: string) {
  vi.resetModules();
  if (styleUrl === undefined) {
    delete process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  } else {
    process.env.NEXT_PUBLIC_MAP_STYLE_URL = styleUrl;
  }
  return import('@/lib/client/map-style');
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  vi.unstubAllGlobals();
});

describe('glyph errors', () => {
  it('are not treated as basemap failures', async () => {
    const { isGlyphError } = await load();

    // What MapLibre actually reports when a font endpoint is unreachable.
    expect(
      isGlyphError(
        'AJAXError: Not Found (404): https://demotiles.maplibre.org/font/Noto%20Sans%20Regular/0-255.pbf',
      ),
    ).toBe(true);
    expect(isGlyphError('Failed to load glyph range')).toBe(true);
  });

  it('do not swallow a real tile failure', async () => {
    const { isGlyphError } = await load();
    expect(isGlyphError('AJAXError: Forbidden (403): https://tile.example/12/2554/1547.png')).toBe(
      false,
    );
  });
});

describe('map style resolution', () => {
  it('uses the built-in style with no probe when nothing is configured', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { initialMapStyle, resolveMapStyle } = await load();

    const initial = initialMapStyle();
    expect(initial).not.toBeNull();
    expect(typeof initial).toBe('object');
    await expect(resolveMapStyle()).resolves.toBe(initial);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('defers to a configured style that loads', async () => {
    const url = 'https://tiles.example/style.json';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const { initialMapStyle, resolveMapStyle } = await load(url);

    expect(initialMapStyle()).toBeNull();
    await expect(resolveMapStyle()).resolves.toBe(url);
  });

  it('falls back to the built-in style when a configured style is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const { resolveMapStyle } = await load('https://tiles.example/style.json');

    const resolved = await resolveMapStyle();
    expect(typeof resolved).toBe('object');
  });

  it('falls back when the style request fails outright', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { resolveMapStyle } = await load('https://tiles.example/style.json');

    const resolved = await resolveMapStyle();
    expect(typeof resolved).toBe('object');
  });

  it('treats the MapLibre demo style as unset', async () => {
    // It loads perfectly and renders nothing recognisable above zoom 5, so no
    // error handler can catch it — it has to be rejected up front.
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { initialMapStyle, resolveMapStyle } = await load(
      'https://demotiles.maplibre.org/style.json',
    );

    expect(initialMapStyle()).not.toBeNull();
    await expect(resolveMapStyle()).resolves.toEqual(expect.objectContaining({ version: 8 }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('probes only once however many maps ask', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    const { resolveMapStyle } = await load('https://tiles.example/style.json');

    await Promise.all([resolveMapStyle(), resolveMapStyle(), resolveMapStyle()]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
