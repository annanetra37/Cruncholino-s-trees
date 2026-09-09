/*
 * T4.5 — service worker.
 *
 * Deliberately minimal. It caches the app shell so the capture flow opens with
 * no connection, and it does NOT cache API responses: showing a contributor a
 * stale map they cannot tell is stale would be worse than showing nothing.
 *
 * The queue of unsent trees lives in IndexedDB (src/lib/client/offline-queue.ts),
 * not here, so it survives service-worker updates.
 */
const CACHE = 'cruncholino-shell-v1';
const SHELL = ['/', '/add', '/dashboard', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API responses are never served from cache — see the note above.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.mode === 'navigate') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('/add');
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
      }),
  );
});
