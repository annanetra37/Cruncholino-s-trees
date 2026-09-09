'use client';

import { useEffect } from 'react';

/** Registers the offline shell worker. Failure here is never fatal. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Registering during development fights the dev server's hot reload.
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  return null;
}
