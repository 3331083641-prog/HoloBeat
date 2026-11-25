import type { ForgeDraft, MintedCard } from '../types/holo';

const DB_NAME = 'HoloBeatStudioDB';
const DB_VERSION = 1;
const STORE_KV = 'kv';
const STORE_AUDIO = 'audio_cache';

export interface CachedAudioEntry {
  snapshotId: string;
  wavBlob: Blob;
  waveformBars: number[];
  durationSec: number;
  cachedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV);
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO, { keyPath: 'snapshotId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function kvGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function kvSet<T>(key: string, value: T): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export const holoDb = {
  /** Safely backup legacy localStorage state before any schema upgrade */
  backupLegacyLocalStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (localStorage.getItem('holobeat-backup-pre-v3')) return;
      const legacy =
        localStorage.getItem('holobeat-studio-v2') ??
        localStorage.getItem('holobeat-studio-v1');
      if (legacy) {
        localStorage.setItem('holobeat-backup-pre-v3', legacy);
      }
    } catch {
      // Ignore quota errors
    }
  },

  async saveMintedCards(cards: MintedCard[]): Promise<boolean> {
    const ok = await kvSet('mintedCards', cards);
    // Keep lightweight mirror in localStorage as fallback when storage quota permits
    try {
      localStorage.setItem('holobeat-minted-mirror-v3', JSON.stringify(cards));
    } catch {
      // IndexedDB is primary store
    }
    return ok;
  },

  async loadMintedCards(): Promise<MintedCard[] | null> {
    const fromIdb = await kvGet<MintedCard[]>('mintedCards');
    if (fromIdb && Array.isArray(fromIdb)) return fromIdb;
    try {
      const mirror = localStorage.getItem('holobeat-minted-mirror-v3');
      if (mirror) {
        const parsed = JSON.parse(mirror) as MintedCard[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore parse failure
    }
    return null;
  },

  async saveForgeDraft(draft: ForgeDraft): Promise<boolean> {
    return kvSet('forgeDraft', draft);
  },

  async loadForgeDraft(): Promise<ForgeDraft | null> {
    return kvGet<ForgeDraft>('forgeDraft');
  },

  async saveAudioCache(entry: CachedAudioEntry): Promise<boolean> {
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        tx.objectStore(STORE_AUDIO).put(entry);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  },

  async getAudioCache(snapshotId: string): Promise<CachedAudioEntry | null> {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_AUDIO, 'readonly');
        const req = tx.objectStore(STORE_AUDIO).get(snapshotId);
        req.onsuccess = () => resolve((req.result as CachedAudioEntry) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  },

  async deleteAudioCache(snapshotId: string): Promise<void> {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        tx.objectStore(STORE_AUDIO).delete(snapshotId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },
};
