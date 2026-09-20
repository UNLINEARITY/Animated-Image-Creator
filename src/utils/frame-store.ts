// IndexedDB-backed persistence for the frame list, so a normal page refresh
// keeps your work. Clearing the frame list (Clear All / removing every frame)
// wipes the store.
import type { Frame } from '../App';

const DB_NAME = 'animated-image-creator';
const STORE = 'session';
const KEY = 'frames';

// A Frame without the session-scoped object URL (recreated on restore).
export type PersistedFrame = Omit<Frame, 'previewUrl'>;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function saveFrames(frames: Frame[]): Promise<void> {
  const serializable: PersistedFrame[] = frames.map(({ previewUrl: _url, ...rest }) => rest);
  await withStore('readwrite', (s) => s.put({ savedAt: Date.now(), frames: serializable }, KEY));
}

export async function loadFrames(): Promise<PersistedFrame[] | null> {
  try {
    const entry = await withStore(
      'readonly',
      (s) => s.get(KEY) as IDBRequest<{ savedAt: number; frames: PersistedFrame[] } | undefined>
    );
    return entry?.frames?.length ? entry.frames : null;
  } catch {
    return null; // storage unavailable (e.g. private mode) — run without persistence
  }
}

export async function clearFrames(): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(KEY) as unknown as IDBRequest<undefined>);
  } catch {
    // ignore — nothing to clean up
  }
}
