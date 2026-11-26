import { z } from 'zod';
import { createSchemas } from '../../../shared/card-schema.mjs';
import {
  RENDERER_VERSION, buildAudioCacheKey, computeSoundSigilSeed, createBeatCompositionSnapshot, normalizePinballEvents,
} from '../audio/compositionEngine.ts';
import { buildMintIdempotencyKey } from "../../../shared/card-content.ts";
import { migrateMintedCard } from "./schema.ts";
import type { StorageSaveResult, MigrationReport, RenderArtifact, BeatSnapshot, CompositionSnapshot, ForgeDraft, MintedCard, PinballRecordedEvent } from '../types/holo';

const DB_NAME = 'HoloBeatStudioDB';
const DB_VERSION = 3;
const LIBRARY = 'library-v2';
const MIRROR = 'holobeat-library-v4';
const { MintedCardSchema, ForgeDraftSchema, ProjectSchema } = createSchemas(z);
export { ProjectSchema };

export interface CachedAudioEntry extends RenderArtifact { snapshotId: string }
type TestWriteFailureMode = 'none' | 'idb-only' | 'all-fail';
let testWriteFailureMode: TestWriteFailureMode = 'none';

export interface Library {
  migrationReport?: MigrationReport;
  cards: MintedCard[];
  nextMintSerial: number;
}
interface StoredLibrary extends Library {
  waveformRendererVersion?: string;
  version: 2;
  revision: number;
  head?: string;
  primaryHead?: string;
  mirrorHead?: string;
}
type SaveResult = StorageSaveResult & (
  | { status: 'primary' | 'fallback'; library: Library }
  | { status: 'failed'; error: string });

let upgradeBlocked = false;
async function openDb(): Promise<IDBDatabase> {
  if (upgradeBlocked) throw new DOMException('请先关闭仍在使用旧收藏库的标签页', 'InvalidStateError');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      upgradeBlocked = true;
      reject(new DOMException('数据库升级被其他标签页占用，请关闭后重试', 'InvalidStateError'));
    };
    request.onupgradeneeded = (event) => {
      if (blocked) { upgradeBlocked = false; request.transaction!.abort(); return; }
      const db = request.result;
      if (event.oldVersion < 1) {
        db.createObjectStore('kv');
      }
      if (event.oldVersion < 3) {
        // v1 caches lack a content digest. The KV originals remain available for migration recovery.
        if (db.objectStoreNames.contains('audio_cache')) db.deleteObjectStore('audio_cache');
        db.createObjectStore('audio_cache', { keyPath: 'cacheKey' });
        if (!db.objectStoreNames.contains('projectFiles')) db.createObjectStore('projectFiles');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) { upgradeBlocked = false; db.close(); }
      else resolve(db);
    };
    request.onerror = () => { if (blocked) upgradeBlocked = false; reject(request.error); };
  });
}

async function runRequest<T>(
  store: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      tx.onabort = () => reject(tx.error ?? new Error('事务已终止'));
      tx.onerror = () => reject(tx.error ?? new Error('数据库请求失败'));
      const request = operation(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result);
    });
  } finally {
    db.close();
  }
}

function localRead(key: string) {
  try { return localStorage.getItem(key); }
  catch { return null; } // IndexedDB remains usable when storage access is denied.
}
function localWrite(key: string, value: string) {
  localStorage.setItem(key, value);
  if (localStorage.getItem(key) !== value) throw new Error('镜像回读不一致');
}

const idbRead = <T>(key: string) => runRequest<T | undefined>('kv', 'readonly', store => store.get(key));
const idbPut = (key: string, value: unknown) => runRequest('kv', 'readwrite', store => store.put(value, key));

let queue: Promise<unknown> = Promise.resolve();
async function exclusive<T>(action: () => Promise<T>): Promise<T> {
  // Chromium's origin-scoped lock covers IDB writes and the verified fallback mirror together.
  if (globalThis.navigator?.locks) return navigator.locks.request('holobeat-library-v2', action);
  const next = queue.then(action, action);
  queue = next.catch(() => undefined);
  return next;
}

function validateLibrary(data: StoredLibrary): StoredLibrary {
  if (data?.version !== 2 || !Number.isSafeInteger(data.revision) || data.revision < 1 ||
      !Number.isSafeInteger(data.nextMintSerial) || data.nextMintSerial < 1 || !Array.isArray(data.cards)) {
    throw new Error('收藏库版本或编号无效');
  }
  const ids = new Set<string>(), serials = new Set<number>(), codes = new Set<string>();
  for (const card of data.cards) {
    if (!MintedCardSchema.safeParse(card).success || ids.has(card.id) || serials.has(card.serialNumber) ||
        codes.has(card.code) || card.serialNumber >= data.nextMintSerial) throw new Error('藏品校验或唯一编号校验失败');
    ids.add(card.id); serials.add(card.serialNumber); codes.add(card.code);
  }
  return data;
}

// Convert pre-snapshot localStorage works while retaining their original code and identity.
async function migrateCard(value: MintedCard & {beatSnapshot?: BeatSnapshot; pinballEvents?: PinballRecordedEvent[]}): Promise<MintedCard> {
  let card: MintedCard = value;
  if (!value.snapshot) {
    const { beatSnapshot, pinballEvents, ...original } = value;
    let snapshot: CompositionSnapshot;
    if (value.sourceType === 'beat' && beatSnapshot) {
      snapshot = createBeatCompositionSnapshot({
        ...beatSnapshot, bars: beatSnapshot.bars ?? 1,
        liveFx: beatSnapshot.liveFx ?? { stutter: false, echo: false, bitcrush: false },
      });
    } else if (value.sourceType === 'pinball' && Array.isArray(pinballEvents)) {
      const events = normalizePinballEvents(pinballEvents);
      snapshot = { sourceType: 'pinball', bpm: 116, scale: 'PENTA_C', capturedAt: value.createdAt,
        id: '', durationMs: Math.max(1200, ...events.map(e => e.timeOffsetMs + e.durationMs)),
        events, pinballEvents };
    } else throw new Error('旧版藏品缺少编曲或录音');
    snapshot.id = 'snapshot-' + value.id;
    snapshot.capturedAt = value.createdAt;
    card = { ...original, snapshot, serialNumber: Number(/^#MY-(\d+)$/.exec(value.code)?.[1]),
      lineageDepth: 0, audioFingerprintSeed: computeSoundSigilSeed(snapshot),
      idempotencyKey: 'legacy-' + value.id };
  }
  if ((card.schemaVersion ?? 2) < 3) {
    const migrated = migrateMintedCard(card);
    if (!migrated) throw new Error('旧版收藏无法迁移');
    card = migrated;
  }
  if (!MintedCardSchema.safeParse(card).success) throw new Error('旧版藏品校验失败，原件已保留');
  // The original cache had no validated PCM digest or extractor version. Keep its bars as a
  // preview until the current renderer has produced the waveform for this exact snapshot.
  return { ...card, waveformIsRealPcm: false, contentHash: await buildMintIdempotencyKey(card) };
}

type ReadResult = { state: StoredLibrary; migrate: boolean; primaryHead?: string; mirrorHead?: string };
async function readCollectionRecord<T>(key: string) {
  try { return await idbRead<T>(key); }
  catch (error) {
    if ((error instanceof DOMException && error.name === 'SecurityError') || typeof indexedDB === 'undefined') return undefined;
    throw error;
  }
}
async function readLibrary(initial: Library): Promise<ReadResult> {
  const primary = await readCollectionRecord<StoredLibrary>(LIBRARY);
  const raw = localRead(MIRROR);
  const entry = raw === null ? undefined : JSON.parse(raw);
  // A small witness replaces an obsolete mirror if a full copy exceeded quota.
  if (entry?.primaryOnly && !primary) throw new Error('最新收藏仅保存在 IndexedDB，请恢复访问后重试');
  const mirror: StoredLibrary | undefined = entry?.primaryOnly ? undefined : entry;
  if (primary || mirror) {
    let newest = primary ?? mirror!;
    if (primary && mirror && primary.head !== mirror.head) {
      if (mirror.primaryHead === primary.head) newest = mirror;
      else if (primary.mirrorHead !== mirror.head) {
        // Independently edited, e.g. an inaccessible IDB and a missing mirror. Preserve both originals.
        throw new Error('两份收藏库分别发生过修改，请保留两份数据并处理冲突');
      }
    }
    const verified = validateLibrary(newest);
    const state = verified.waveformRendererVersion === RENDERER_VERSION ? verified : {
      ...verified, cards: verified.cards.map(card => card.waveformIsRealPcm
        ? { ...card, waveformIsRealPcm: false } : card),
    };
    return { state, migrate: newest === mirror && !!primary && newest.head !== primary.head,
      primaryHead: primary?.head ?? mirror?.primaryHead, mirrorHead: mirror?.head };
  }

  const oldIdb = await readCollectionRecord<MintedCard[]>('mintedCards');
  const batches: MintedCard[][] = [];
  if (oldIdb !== undefined) batches.push(oldIdb);
  let nextMintSerial = initial.nextMintSerial;
  const legacyKeys = ['holobeat-minted-mirror-v3', 'holobeat-studio-v2', 'holobeat-studio-v1'];
  for (const key of legacyKeys) {
    const source = localRead(key);
    if (source === null) continue;
    const obj = JSON.parse(source);
    const old = obj.state ?? obj;
    const cards = key === legacyKeys[0] ? obj : old.mintedCards;
    if (!cards) continue;
    if (!Array.isArray(cards)) throw new Error('旧版收藏格式错误');
    // Independent, byte-for-byte backup before conversion. Never overwrite or remove the source.
    const backupKey = 'migration-backup:' + key;
    if (localRead(backupKey) !== source) {
      try { localWrite(backupKey, source); }
      catch { await idbPut(backupKey, source); }
    }
    batches.push(cards);
    if (Number.isSafeInteger(old.nextMintSerial)) nextMintSerial = Math.max(nextMintSerial, old.nextMintSerial);
  }
  if (!batches.length) return { state: { version: 2, revision: 0, ...initial }, migrate: false };
  const byId = new Map<string, MintedCard>();
  const usedSerials = new Set<number>();
  const usedCodes = new Set<string>();
  const reassign: MintedCard[] = [];
  let sourceVersion = 3;
  let sourceCount = 0;
  for (const batch of batches) {
    const localIds = new Set<string>(), localSerials = new Set<number>(), localCodes = new Set<string>();
    for (const value of batch) {
      sourceVersion = Math.min(sourceVersion, value.schemaVersion ?? (value.snapshot ? 2 : 1));
      const card = await migrateCard(value);
      if (localIds.has(card.id) || localSerials.has(card.serialNumber) || localCodes.has(card.code)) {
        throw new Error('旧版收藏内有重复编号，请核对原件');
      }
      localIds.add(card.id); localSerials.add(card.serialNumber); localCodes.add(card.code);
      // Priority for a shared id is v1 IDB, then its mirror, then earlier local-only releases.
      if (byId.has(card.id)) continue;
      sourceCount++;
      byId.set(card.id, card);
      nextMintSerial = Math.max(nextMintSerial, card.serialNumber + 1);
      if (usedSerials.has(card.serialNumber) || usedCodes.has(card.code)) reassign.push(card);
      usedSerials.add(card.serialNumber); usedCodes.add(card.code);
    }
  }
  // Independent v1/v2 libraries both started at #MY-01. Keep every distinct work, original IDs
  // and original backups, allocating a new display number only for lower-priority collisions.
  for (const card of reassign) {
    while (usedCodes.has('#MY-' + String(nextMintSerial).padStart(2, '0'))) nextMintSerial++;
    card.serialNumber = nextMintSerial++;
    card.code = '#MY-' + String(card.serialNumber).padStart(2, '0');
    usedCodes.add(card.code);
  }
  const cards = [...byId.values()];
  if (cards.length !== sourceCount) throw new Error('迁移数量校验失败');
  for (const card of cards) {
    const parent = card.parentCardId && byId.get(card.parentCardId);
    if (parent) card.parentCode = parent.code;
  }
  const migrationReport: MigrationReport = {
    migrated: true, backedUp: true, fromVersion: sourceVersion, toVersion: 3,
    cardCount: cards.length, maxSerial: cards.reduce((m, c) => Math.max(m, c.serialNumber), 0),
    verifiedPlayable: cards.every(c => c.snapshot.durationMs > 0),
    warnings: reassign.map(c => '已保留冲突藏品并分配新展示编号 ' + c.code),
  };
  return { state: validateLibrary({ version: 2, revision: 1, cards, nextMintSerial, migrationReport }), migrate: true };
}

async function commit(next: StoredLibrary, previous: ReadResult): Promise<SaveResult> {
  const head = crypto.randomUUID();
  const library = { ...next, head, waveformRendererVersion: RENDERER_VERSION, primaryHead: previous.primaryHead, mirrorHead: previous.mirrorHead };
  validateLibrary(library);
  if (testWriteFailureMode === 'all-fail') return { status: 'failed', storageLabel: '设备存储写入失败', error: '模拟存储空间不足' };
  try {
    if (testWriteFailureMode === 'idb-only') throw new Error('模拟 IndexedDB 事务中断');
    library.cards = next.cards.map(c => ({ ...c, storageStatus: 'primary' }));
    await idbPut(LIBRARY, library);
  } catch {
    try {
      library.cards = next.cards.map(c => ({ ...c, storageStatus: 'fallback' }));
      localWrite(MIRROR, JSON.stringify(library));
      return { status: 'fallback', storageLabel: '已降级保存至此设备（已验证镜像）', library };
    }
    catch (error) { return { status: 'failed', storageLabel: '设备存储写入失败', error: String(error) }; }
  }
  try { localWrite(MIRROR, JSON.stringify({ ...library, primaryHead: head })); }
  catch {
    try { localWrite(MIRROR, JSON.stringify({ primaryOnly: head })); }
    catch { /* The IDB transaction committed. The previous mirror is immutable while storage is denied. */ }
  }
  return { status: 'primary', storageLabel: '已保存至此设备（IndexedDB 主存储）', library };
}

export const holoDb = {
  setTestWriteFailureMode(mode: TestWriteFailureMode) { testWriteFailureMode = mode; },
  async loadLibrary(initial: Library): Promise<Library> {
    return exclusive(async () => {
      const previous = await readLibrary(initial);
      const { state, migrate } = previous;
      if (migrate) {
        const result = await commit(state, previous);
        if (result.status === 'failed') throw new Error(result.error);
        if (result.status === 'primary') {
          const stored = await idbRead<StoredLibrary>(LIBRARY);
          if (!stored || stored.nextMintSerial !== state.nextMintSerial || stored.cards.length !== state.cards.length ||
              stored.cards.some((c, i) => c.id !== state.cards[i].id || c.serialNumber !== state.cards[i].serialNumber ||
                c.code !== state.cards[i].code)) throw new Error('迁移后数量或编号校验失败，原件已保留');
        }
        return result.library;
      }
      return state;
    });
  },

  async saveMintedCards(initial: Library, update: (current: Library) => Library | Promise<Library>): Promise<SaveResult> {
    try {
      return await exclusive(async () => {
        const previous = await readLibrary(initial);
        const { state } = previous;
        const next = await update(state);
        return commit({ migrationReport: state.migrationReport, ...next, version: 2, revision: state.revision + 1 }, previous);
      });
    } catch (error) { return { status: 'failed', storageLabel: '设备存储写入失败', error: String(error) }; }
  },

  async saveForgeDraft(draft: ForgeDraft): Promise<StorageSaveResult> {
    return exclusive<StorageSaveResult>(async () => {
      if (testWriteFailureMode === 'all-fail') throw new Error('模拟存储空间不足');
      const old = await idbRead<{revision:number}>('draft-v2').catch(() => undefined);
      const mirror = JSON.parse(localRead('holobeat-draft-v4') ?? 'null');
      const entry = { revision: Math.max(old?.revision ?? 0, mirror?.revision ?? 0) + 1, draft };
      let written = false;
      try { if (testWriteFailureMode !== 'none') throw new Error('模拟写入失败'); await idbPut('draft-v2', entry); written = true; }
      catch { /* verified localStorage fallback below */ }
      try { localWrite('holobeat-draft-v4', JSON.stringify(entry)); }
      catch (error) { if (!written) throw error; }
      return { status: written ? 'primary' : 'fallback', storageLabel: written ? '草稿已保存' : '草稿已降级保存' };
    }).catch(error => ({ status: 'failed', storageLabel: '草稿保存失败', error: String(error) }));
  },

  async loadForgeDraft(): Promise<ForgeDraft | null> {
    const primary = await idbRead<{revision:number;draft:ForgeDraft}>('draft-v2').catch(() => undefined);
    const mirror = JSON.parse(localRead('holobeat-draft-v4') ?? 'null');
    const newest = primary && (!mirror || primary.revision >= mirror.revision) ? primary : mirror;
    const draft = newest?.draft ?? await idbRead<ForgeDraft>('forgeDraft').catch(() => undefined);
    const legacy = draft ?? JSON.parse(localRead('holobeat-draft-mirror-v3') ?? 'null');
    if (legacy && !ForgeDraftSchema.safeParse(legacy).success) throw new Error('草稿校验失败');
    return legacy ?? null;
  },

  async saveAudioCache(entry: RenderArtifact): Promise<boolean> {
    if (testWriteFailureMode !== 'none') return false;
    return runRequest('audio_cache', 'readwrite', store => store.put(entry))
      .then(() => true, () => false);
  },
  async getAudioCache(cacheKey: string, legacySnapshotId?: string): Promise<RenderArtifact | null> {
    const read = (key: string) => runRequest<RenderArtifact>('audio_cache', 'readonly', store => store.get(key))
      .then(v => v ?? null, () => null);
    return await read(cacheKey) ?? (legacySnapshotId ? await read(legacySnapshotId) : null);
  },
  async deleteAudioCacheIfUnused(cacheKey: string, cards: MintedCard[], draft: ForgeDraft | null): Promise<boolean> {
    if (cards.some(c => c.audioCacheKey === cacheKey || c.snapshot.id === cacheKey) ||
        (draft?.snapshot && (buildAudioCacheKey(draft.snapshot) === cacheKey || draft.snapshot.id === cacheKey))) return false;
    return runRequest('audio_cache', 'readwrite', store => store.delete(cacheKey)).then(() => true, () => false);
  },
};
