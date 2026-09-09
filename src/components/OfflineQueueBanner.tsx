'use client';

/**
 * T4.5 — the visible pending count.
 *
 * Someone who has just recorded three trees in a valley with no signal needs to
 * see that the app still has them. A silent queue is indistinguishable from
 * lost data.
 */
import { useEffect, useState } from 'react';
import { count, subscribe, sync } from '@/lib/client/offline-queue';

export function OfflineQueueBanner() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = () => void count().then(setPending);
    refresh();

    const unsubscribe = subscribe(refresh);
    setOnline(navigator.onLine);

    const goOnline = async () => {
      setOnline(true);
      setSyncing(true);
      await sync();
      setSyncing(false);
      refresh();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Also try once on mount: the browser may have come back online while the
    // tab was closed.
    if (navigator.onLine) void goOnline();

    return () => {
      unsubscribe();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (pending === 0 && online) return null;

  return (
    <div
      role="status"
      className={`px-4 py-2 text-center text-sm ${
        online ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-100 text-amber-900'
      }`}
    >
      {!online ? <span>You’re offline — new trees are saved on this device. </span> : null}
      {pending > 0 ? (
        <span>
          {pending} tree{pending === 1 ? '' : 's'} waiting to upload
          {syncing ? ' — syncing…' : ''}
          {online && !syncing ? (
            <button
              type="button"
              className="ml-2 underline"
              onClick={async () => {
                setSyncing(true);
                await sync();
                setSyncing(false);
                setPending(await count());
              }}
            >
              Sync now
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
