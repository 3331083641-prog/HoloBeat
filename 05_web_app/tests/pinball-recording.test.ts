import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { holoDb } from '../src/storage/holoDb.ts';
import type { PinballRecordedEvent } from '../src/types/holo.ts';

const phrase: PinballRecordedEvent[] = [
  { id:'hit-a', cardId:'card-01', note:'C4', velocity:0.76, color:'#FF5526',
    timeOffsetMs:0, durationMs:80, sourceX:110, sourceY:220 },
  { id:'hit-b', cardId:'card-05', note:'G5', velocity:0.91, color:'#00D4AA',
    timeOffsetMs:1730, durationMs:120, sourceX:340, sourceY:180 },
];
let loadCount = 0;

async function freshStore() {
  // New Zustand module instance on each load; the browser's two storage backends survive.
  const url = new URL('../src/store/useHoloStore.ts', import.meta.url);
  url.searchParams.set('pageLoad', String(++loadCount));
  const module: typeof import('../src/store/useHoloStore.ts') = await import(url.href);
  return module.useHoloStore;
}

beforeEach(() => {
  const records = new Map<string, string>();
  Object.defineProperty(globalThis, 'indexedDB', { configurable:true, value:new IDBFactory() });
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => records.set(key, value),
    removeItem: (key: string) => records.delete(key),
  } });
});

test('free recording survives immediate page switch and reload with complete ordered events', async () => {
  const store = await freshStore();
  const input = structuredClone(phrase);
  store.getState().setPinballRecordedEvents(input);
  input[0].note = 'F4';
  input.pop();
  store.getState().setActivePage('gacha');
  store.getState().setActivePage('pinball');
  assert.deepEqual(store.getState().pinballRecordedEvents, phrase);

  const restored = await freshStore();
  assert.deepEqual(restored.getState().pinballRecordedEvents, phrase);
  await restored.persist.rehydrate();
  await restored.getState().hydrateFromIndexedDb();
  assert.deepEqual(restored.getState().pinballRecordedEvents, phrase);
});

test('late IndexedDB hydration cannot resurrect an explicitly cleared recording', async t => {
  const store = await freshStore();
  store.getState().setPinballRecordedEvents(structuredClone(phrase));
  const next = await freshStore();
  let resume!: () => void;
  const gate = new Promise<void>(resolve => { resume = resolve; });
  const readLibrary = holoDb.loadLibrary.bind(holoDb);
  t.mock.method(holoDb, 'loadLibrary', async (initial: Parameters<typeof readLibrary>[0]) => {
    await gate;
    return readLibrary(initial);
  });
  const hydrating = next.getState().hydrateFromIndexedDb();
  next.getState().setPinballAutoDrop(false);
  next.getState().setPinballRecordedEvents([]);
  resume();
  await hydrating;
  assert.deepEqual(next.getState().pinballRecordedEvents, []);
  const reloaded = await freshStore();
  await reloaded.persist.rehydrate();
  assert.deepEqual(reloaded.getState().pinballRecordedEvents, []);
  assert.equal(reloaded.getState().pinballAutoDrop, false);
});

test('free recording clear and subsequent hits leave the captured Forge snapshot intact', async () => {
  const store = await freshStore();
  store.getState().setPinballRecordedEvents(structuredClone(phrase));
  assert.equal(store.getState().sendPinballToForge([]), true);
  const captured = structuredClone(store.getState().forgeDraft.snapshot);
  assert.equal(captured?.sourceType, 'pinball');
  assert.equal(captured.pinballEvents?.length, 2);
  assert.equal(captured.pinballEvents?.[1].timeOffsetMs, 1730);
  store.getState().setPinballRecordedEvents([]);
  store.getState().setPinballRecordedEvents([{ ...phrase[0], id:'next-take', note:'E4' }]);
  assert.deepEqual(store.getState().forgeDraft.snapshot, captured);
});

const recordingKey = 'holobeat-studio-v3';
function storedRecording(storage: Storage) {
  return JSON.parse(storage.getItem(recordingKey)!).state.pinballRecordedEvents;
}
function warningCount(store: Awaited<ReturnType<typeof freshStore>>) {
  return store.getState().toasts.filter(toast => toast.text.includes('刷新可能恢复旧录音')).length;
}

test('quota failure keeps new hits and clear in memory; a verified write re-arms the warning', async t => {
  const store = await freshStore();
  const storage = globalThis.localStorage;
  const added = [...phrase, { ...phrase[1], id:'third', timeOffsetMs:2130 }];
  const write = store.getState().setPinballRecordedEvents;
  write(phrase);
  assert.deepEqual(storedRecording(storage), phrase);
  const failWrites = () => t.mock.method(storage, 'setItem', () => {
    throw new DOMException('Test quota exhausted', 'QuotaExceededError');
  });
  const quota = failWrites();
  write(added);
  assert.deepEqual(store.getState().pinballRecordedEvents, added);
  assert.deepEqual(storedRecording(storage), phrase);
  assert.equal(warningCount(store), 1);
  write([]);
  assert.deepEqual(store.getState().pinballRecordedEvents, []);
  assert.deepEqual(storedRecording(storage), phrase);
  assert.equal(warningCount(store), 1);

  quota.mock.restore();
  write(added);
  assert.deepEqual(storedRecording(storage), added);
  assert.equal(warningCount(store), 1);
  failWrites();
  write([]);
  assert.deepEqual(store.getState().pinballRecordedEvents, []);
  assert.deepEqual(storedRecording(storage), added);
  assert.equal(warningCount(store), 2);
});

test('silent writes and denied localStorage getter detect stale bytes and recover on verified clear', async t => {
  const store = await freshStore();
  const storage = globalThis.localStorage;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
  const write = store.getState().setPinballRecordedEvents;
  write(phrase);
  const ignored = t.mock.method(storage, 'setItem', () => undefined);
  write([]);
  assert.deepEqual(store.getState().pinballRecordedEvents, []);
  assert.deepEqual(storedRecording(storage), phrase);
  assert.equal(warningCount(store), 1);
  ignored.mock.restore();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Test storage denied', 'SecurityError'); },
  });
  try {
    const replacement = [{ ...phrase[0], id:'under-denied-access' }];
    write(replacement);
    assert.deepEqual(store.getState().pinballRecordedEvents, replacement);
    assert.deepEqual(storedRecording(storage), phrase);
    assert.equal(warningCount(store), 1);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', descriptor);
  }
  write([]);
  assert.deepEqual(storedRecording(storage), []);
  const reloaded = await freshStore();
  assert.deepEqual(reloaded.getState().pinballRecordedEvents, []);
  assert.equal(warningCount(reloaded), 0);
});
