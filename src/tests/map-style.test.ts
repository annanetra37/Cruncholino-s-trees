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

  it('probes only once however many maps ask', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    const { resolveMapStyle } = await load('https://tiles.example/style.json');

    await Promise.all([resolveMapStyle(), resolveMapStyle(), resolveMapStyle()]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
