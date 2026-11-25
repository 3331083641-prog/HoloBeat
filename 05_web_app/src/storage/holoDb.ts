import type { ForgeDraft, MintedCard, RenderArtifact, StorageSaveResult } from '../types/holo';

const DB_NAME = 'HoloBeatStudioDB';
const DB_VERSION = 2;
const STORE_KV = 'kv';
const STORE_AUDIO = 'audio_cache';
const MIRROR_KEY_CARDS = 'holobeat-minted-mirror-v3';
const MIRROR_KEY_DRAFT = 'holobeat-draft-mirror-v3';
const BACKUP_KEY_PRE_V3 = 'holobeat-backup-pre-v3';

export interface CachedAudioEntry extends RenderArtifact {
  /** Backward-compatible keyPath (stores cacheKey or legacy snapshotId) */
  snapshotId: string;
}

type TestWriteFailureMode = 'none' | 'idb-only' | 'all-fail';
let testWriteFailureMode: TestWriteFailureMode = 'none';

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

async function kvSet<T>(key: string, value: T): Promise<{ ok: boolean; error?: string }> {
  if (testWriteFailureMode !== 'none') {
    return { ok: false, error: 'IndexedDB 模拟写入失败（存储空间不足或权限受限）' };
  }
  const db = await openDb();
  if (!db) return { ok: false, error: '当前环境不可用 IndexedDB' };
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put(value, key);
      tx.oncomplete = () => resolve({ ok: true });
      tx.onerror = () =>
        resolve({ ok: false, error: tx.error?.message ?? 'IndexedDB 事务写入失败' });
      tx.onabort = () =>
        resolve({ ok: false, error: tx.error?.message ?? 'IndexedDB 事务中止（可能空间不足）' });
    } catch (err) {
      resolve({ ok: false, error: err instanceof Error ? err.message : 'IndexedDB 写入异常' });
    }
  });
}

export const holoDb = {
  /** Strictly for automated failure-path & quota verification tests */
  setTestWriteFailureMode(mode: TestWriteFailureMode): void {
    testWriteFailureMode = mode;
  },

  /** Safely backup legacy localStorage state BEFORE any migration runs */
  backupLegacyLocalStorage(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      if (localStorage.getItem(BACKUP_KEY_PRE_V3)) return true;
      const legacy =
        localStorage.getItem('holobeat-studio-v2') ??
        localStorage.getItem('holobeat-studio-v1') ??
        localStorage.getItem(MIRROR_KEY_CARDS);
      if (legacy) {
        localStorage.setItem(BACKUP_KEY_PRE_V3, legacy);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Persist minted cards with strict three-state accountability:
   * - 'primary': written cleanly to IndexedDB (primary device store)
   * - 'fallback': IndexedDB failed, safely stored in localStorage fallback
   * - 'failed': BOTH primary and fallback failed -> caller MUST rollback and never fake success!
   */
  async saveMintedCards(cards: MintedCard[]): Promise<StorageSaveResult> {
    const idbRes = await kvSet('mintedCards', cards);

    let mirrorOk = false;
    let mirrorErr: string | undefined;
    if (testWriteFailureMode !== 'all-fail' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(MIRROR_KEY_CARDS, JSON.stringify(cards));
        mirrorOk = true;
      } catch (err) {
        mirrorErr = err instanceof Error ? err.message : 'localStorage 配额不足';
      }
    } else if (testWriteFailureMode === 'all-fail') {
      mirrorErr = '浏览器本地存储空间不足（模拟配额超限）';
    }

    if (idbRes.ok) {
      return { status: 'primary', storageLabel: '已保存至此设备（IndexedDB 主存储）' };
    }
    if (mirrorOk) {
      return {
        status: 'fallback',
        storageLabel: '已降级保存至此设备（浏览器轻量缓存）',
        error: idbRes.error,
      };
    }
    return {
      status: 'failed',
      storageLabel: '设备存储写入失败',
      error: mirrorErr ?? idbRes.error ?? '设备存储空间不足或已禁用本地写入',
    };
  },

  async loadMintedCards(): Promise<MintedCard[] | null> {
    const fromIdb = await kvGet<MintedCard[]>('mintedCards');
    if (fromIdb && Array.isArray(fromIdb)) return fromIdb;
    try {
      if (typeof localStorage !== 'undefined') {
        const mirror = localStorage.getItem(MIRROR_KEY_CARDS);
        if (mirror) {
          const parsed = JSON.parse(mirror) as MintedCard[];
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {
      // Ignore parse failure
    }
    return null;
  },

  async saveForgeDraft(draft: ForgeDraft): Promise<StorageSaveResult> {
    const idbRes = await kvSet('forgeDraft', draft);
    if (idbRes.ok) {
      return { status: 'primary', storageLabel: '草稿已保存至此设备' };
    }
    if (testWriteFailureMode !== 'all-fail' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(MIRROR_KEY_DRAFT, JSON.stringify(draft));
        return { status: 'fallback', storageLabel: '草稿已降级保存', error: idbRes.error };
      } catch (err) {
        return {
          status: 'failed',
          storageLabel: '草稿保存失败',
          error: err instanceof Error ? err.message : idbRes.error,
        };
      }
    }
    return { status: 'failed', storageLabel: '草稿保存失败', error: idbRes.error };
  },

  async loadForgeDraft(): Promise<ForgeDraft | null> {
    const fromIdb = await kvGet<ForgeDraft>('forgeDraft');
    if (fromIdb) return fromIdb;
    try {
      if (typeof localStorage !== 'undefined') {
        const mirror = localStorage.getItem(MIRROR_KEY_DRAFT);
        if (mirror) return JSON.parse(mirror) as ForgeDraft;
      }
    } catch {
      // Ignore parse failure
    }
    return null;
  },

  async saveAudioCache(entry: RenderArtifact): Promise<boolean> {
    if (testWriteFailureMode !== 'none') return false;
    const db = await openDb();
    if (!db) return false;
    const record: CachedAudioEntry = {
      ...entry,
      snapshotId: entry.cacheKey,
    };
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        tx.objectStore(STORE_AUDIO).put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  },

  async getAudioCache(cacheKey: string, legacySnapshotId?: string): Promise<RenderArtifact | null> {
    const db = await openDb();
    if (!db) return null;

    const fetchKey = (key: string): Promise<CachedAudioEntry | null> =>
      new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_AUDIO, 'readonly');
          const req = tx.objectStore(STORE_AUDIO).get(key);
          req.onsuccess = () => resolve((req.result as CachedAudioEntry) ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

    const primary = await fetchKey(cacheKey);
    if (primary) return primary;
    if (legacySnapshotId && legacySnapshotId !== cacheKey) {
      return fetchKey(legacySnapshotId);
    }
    return null;
  },

  /**
   * Reference-counted cache eviction: ONLY deletes audio cache when NO remaining MintedCard
   * and NO active ForgeDraft still references that audio cacheKey!
   */
  async deleteAudioCacheIfUnused(
    cacheKey: string,
    remainingCards: MintedCard[],
    activeDraft: ForgeDraft | null
  ): Promise<boolean> {
    const usedByCard = remainingCards.some(
      (c) => c.audioCacheKey === cacheKey || c.snapshot.id === cacheKey
    );
    const usedByDraft =
      activeDraft?.snapshot !== null &&
      activeDraft?.snapshot !== undefined &&
      (activeDraft.snapshot.id === cacheKey ||
        `${activeDraft.snapshot.rendererVersion ?? ''}::${activeDraft.snapshot.contentSignature ?? ''}` ===
          cacheKey);

    if (usedByCard || usedByDraft) {
      return false;
    }

    const db = await openDb();
    if (!db) return false;
    return new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        tx.objectStore(STORE_AUDIO).delete(cacheKey);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  },
};
