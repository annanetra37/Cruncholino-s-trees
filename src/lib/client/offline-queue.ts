/**
 * T4.5 — the offline queue.
 *
 * A tree recorded in an orchard with no signal must survive the walk back to
 * the road. Entries go into IndexedDB (not localStorage: it is synchronous,
 * capped at a few megabytes and shared with everything else on the origin) and
 * are replayed when connectivity returns.
 *
 * Each entry carries a `clientRef` that the server treats as an idempotency
 * key, so a sync whose response was lost cannot create the tree twice.
 */
export type QueuedTree = {
  clientRef: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const DB_NAME = 'cruncholino-trees';
const DB_VERSION = 1;
const STORE = 'pending-trees';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientRef' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function enqueue(payload: Record<string, unknown>): Promise<QueuedTree> {
  const entry: QueuedTree = {
    clientRef: (payload.clientRef as string) ?? crypto.randomUUID(),
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  entry.payload.clientRef = entry.clientRef;
  await withStore('readwrite', (store) => store.put(entry));
  notify();
  return entry;
}

export async function list(): Promise<QueuedTree[]> {
  if (!isSupported()) return [];
  const entries = await withStore<QueuedTree[]>('readonly', (store) => store.getAll());
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

export async function remove(clientRef: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(clientRef));
  notify();
}

async function markFailed(entry: QueuedTree, error: string): Promise<void> {
  await withStore('readwrite', (store) =>
    store.put({ ...entry, attempts: entry.attempts + 1, lastError: error }),
  );
  notify();
}

export async function count(): Promise<number> {
  if (!isSupported()) return 0;
  return withStore<number>('readonly', (store) => store.count());
}

export type SyncResult = { synced: number; failed: number; remaining: number };

let syncing = false;

/**
 * Replays the queue oldest-first. A 4xx other than 429 means the entry will
 * never succeed — dropping it is better than retrying a malformed record on
 * every page load forever, so it is discarded and reported.
 */
export async function sync(): Promise<SyncResult> {
  if (syncing || !isSupported() || !navigator.onLine) {
    return { synced: 0, failed: 0, remaining: await count() };
  }

  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    for (const entry of await list()) {
      try {
        const response = await fetch('/api/trees', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(entry.payload),
        });

        if (response.ok) {
          await remove(entry.clientRef);
          synced += 1;
          continue;
        }

        const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
        if (permanent && response.status !== 401) {
          await remove(entry.clientRef);
          failed += 1;
          continue;
        }

        await markFailed(entry, `HTTP ${response.status}`);
        failed += 1;
        // A 401 means the session expired: everything after this will fail too.
        if (response.status === 401) break;
      } catch (error) {
        await markFailed(entry, error instanceof Error ? error.message : 'network error');
        failed += 1;
        break; // Offline again — stop hammering.
      }
    }
  } finally {
    syncing = false;
  }

  return { synced, failed, remaining: await count() };
}

// --- change notification ----------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
