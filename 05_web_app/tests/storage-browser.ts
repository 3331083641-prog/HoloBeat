import { useHoloStore } from '../src/store/useHoloStore.ts';
import { holoDb } from '../src/storage/holoDb.ts';

/** Run on a fresh, dedicated Playwright context; fail closed on an existing collection. */
export async function verifyStorageLifecycle() {
  const store = useHoloStore.getState();
  await store.hydrateFromIndexedDb();
  if (useHoloStore.getState().mintedCards.some(c => !c.isDemo)) throw new Error('Expected a fresh browser profile');
  const checks: Record<string, true> = {};
  const check = (name: string, condition: unknown) => {
    if (!condition) throw new Error('Storage lifecycle assertion failed: ' + name);
    checks[name] = true;
  };
  const actual = window.indexedDB;
  const nativeOpen = actual.open.bind(actual);
  const nativePut = IDBObjectStore.prototype.put;
  const nativeWrite = Storage.prototype.setItem;
  const fixture = 'holobeat-storage-test-' + crypto.randomUUID();
  let blockApi = false;
  let quota = false;
  let abort = false;
  Object.defineProperty(actual, 'open', { configurable: true, value(name: string, version?: number) {
    if (blockApi) throw new DOMException('Disabled for this verification', 'SecurityError');
    return nativeOpen(name === 'HoloBeatStudioDB' ? fixture : name, version);
  } });
  Storage.prototype.setItem = function(key: string, value: string) {
    if (quota) throw new DOMException('Quota injection', 'QuotaExceededError');
    nativeWrite.call(this, key, value);
  };
  IDBObjectStore.prototype.put = function(...args: Parameters<typeof nativePut>) {
    const request = nativePut.apply(this, args);
    if (abort && this.name === 'kv' && args[1] === 'library-v2') this.transaction.abort();
    return request;
  };
  let oldTab: IDBDatabase | undefined;
  try {
    oldTab = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = nativeOpen(fixture, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('kv');
        req.result.createObjectStore('audio_cache', { keyPath: 'snapshotId' });
      };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const seed = { cards:store.mintedCards, nextMintSerial:store.nextMintSerial };
    const blocked = await holoDb.saveMintedCards(seed, s => s);
    check('blockedUpgradePreservesCollection', blocked.status === 'failed' && !localStorage.getItem('holobeat-library-v4'));
    oldTab.close();
    // Opening at the original version is queued behind the cancelled upgrade request.
    await new Promise<void>((resolve,reject) => {
      const req = nativeOpen(fixture);
      req.onsuccess = () => {req.result.close(); resolve();}; req.onerror = () => reject(req.error);
    });
    check('upgradeRetry', (await holoDb.saveMintedCards(seed, s => s)).status === 'primary');
    abort = true;
    const minted = await store.mintCurrentCard();
    check('realTransactionAbortFallback', minted?.serialNumber === 1 &&
      JSON.parse(localStorage.getItem('holobeat-library-v4')!).cards[0].id === minted.id &&
      useHoloStore.getState().toasts.at(-1)?.text.includes('降级'));
    abort = false;
    blockApi = true;
    store.setForgeTitle('浏览器降级测试');
    const fallback = await store.mintCurrentCard();
    check('disabledIndexedDBFallback', fallback?.serialNumber === 2);
    quota = true;
    store.setForgeTitle('浏览器重试测试');
    const before = useHoloStore.getState();
    const rejected = await store.mintCurrentCard();
    const after = useHoloStore.getState();
    check('dualStorageFailurePreservesDraft', rejected === null && before.mintedCards === after.mintedCards &&
      before.forgeDraft === after.forgeDraft && before.inspectMintedId === after.inspectMintedId &&
      before.nextMintSerial === after.nextMintSerial);
    blockApi = false;
    const [first, second] = await Promise.all([store.mintCurrentCard(),store.mintCurrentCard()]);
    check('idbOnlyRetryAndDoubleClick', first?.serialNumber === 3 && second === null && first.requestId &&
      first.storageStatus === 'primary');
    const reloaded = await holoDb.loadLibrary({cards:[],nextMintSerial:1});
    check('reopenAfterDegradedAndPrimaryCommits', reloaded.cards.filter(c => !c.isDemo).length === 3 &&
      reloaded.nextMintSerial === 4 && reloaded.cards[0].id === first?.id);
    return checks;
  } finally {
    oldTab?.close();
    delete (actual as Partial<IDBFactory>).open;
    IDBObjectStore.prototype.put = nativePut;
    Storage.prototype.setItem = nativeWrite;
    actual.deleteDatabase(fixture);
  }
}
