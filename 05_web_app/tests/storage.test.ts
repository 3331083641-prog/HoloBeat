import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { useHoloStore } from '../src/store/useHoloStore.ts';
import { holoDb } from '../src/storage/holoDb.ts';
import { buildMintIdempotencyKey } from '../../shared/card-content.ts';

const initial = useHoloStore.getInitialState();
const seed = { cards: [], nextMintSerial: 1 };
const sample = initial.mintedCards[0];
let mirror: Map<string,string>;
let quota = false;
function setDb(value: unknown) {
  Object.defineProperty(globalThis, 'indexedDB', { value, configurable: true });
}
beforeEach(() => {
  setDb(new IDBFactory());
  mirror = new Map(); quota = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => mirror.get(key) ?? null,
    setItem(key: string, value: string) {
      if (quota) throw new DOMException('Quota', 'QuotaExceededError');
      mirror.set(key, value);
    },
    removeItem: (key: string) => mirror.delete(key),
  } });
  useHoloStore.setState(initial, true);
});

test('IDB commits with localStorage quota exceeded; reload retains card and serial', async () => {
  quota = true;
  const minted = await initial.mintCurrentCard();
  assert.ok(minted);
  assert.equal(minted.storageStatus, 'primary');
  useHoloStore.setState(initial, true);
  await initial.hydrateFromIndexedDb();
  assert.equal(useHoloStore.getState().mintedCards[0].id, minted.id);
  assert.equal(useHoloStore.getState().nextMintSerial, 2);
});

test('aborted IDB transaction falls back to verified mirror; new mirror outranks stale IDB', async t => {
  const first = await holoDb.saveMintedCards(seed, () => ({ cards:[sample], nextMintSerial:2 }));
  assert.equal(first.status, 'primary');
  const put = IDBObjectStore.prototype.put;
  const mock = t.mock.method(IDBObjectStore.prototype, 'put', function(this: IDBObjectStore, ...args: Parameters<typeof put>) {
    const req = put.apply(this,args); this.transaction.abort(); return req;
  });
  const fallback = await holoDb.saveMintedCards(seed, lib => ({ ...lib, cards: [] }));
  assert.equal(fallback.status,'fallback');
  mock.mock.restore();
  assert.deepEqual((await holoDb.loadLibrary(seed)).cards,[]);
  assert.equal((await holoDb.loadLibrary(seed)).nextMintSerial,2);
});

test('blocked IDB and lying or quota-limited mirror never report a successful mint; retry uses same serial', async () => {
  setDb(undefined); quota = true;
  const draft = useHoloStore.getState().forgeDraft;
  assert.equal(await initial.mintCurrentCard(),null);
  const s = useHoloStore.getState();
  assert.deepEqual(s.mintedCards, initial.mintedCards);
  assert.equal(s.nextMintSerial,1); assert.equal(s.inspectMintedId,null); assert.equal(s.forgeDraft,draft);
  quota = false;
  const minted = await s.mintCurrentCard();
  assert.equal(minted?.serialNumber,1);
  assert.match(useHoloStore.getState().toasts.at(-1)!.text,/降级/);
  assert.ok(minted?.requestId); assert.match(minted!.contentHash!,/^[a-f0-9]{64}$/);
  assert.ok((await holoDb.loadLibrary(seed)).cards.some(c => c.id === minted?.id));
  Object.defineProperty(globalThis,'localStorage',{ configurable:true, value:{setItem(){}, getItem(){return null;}} });
  assert.equal((await holoDb.saveMintedCards(seed,x=>x)).status,'failed');
});

test('concurrent and sequential mints deduplicate; deleting highest serial and reloading cannot recycle it', async () => {
  const [first, second] = await Promise.all([initial.mintCurrentCard(),initial.mintCurrentCard()]);
  assert.ok(first); assert.equal(second,null);
  assert.equal((await initial.mintCurrentCard())?.id, first.id);
  assert.equal(useHoloStore.getState().mintedCards.length,2);
  const sticker = initial.forgeDraft.stickers[0];
  initial.updateForgeSticker(sticker.uid,{ x:sticker.x + 1 });
  const moved = await initial.mintCurrentCard();
  assert.equal(moved?.serialNumber,2);
  await initial.deleteMintedCard(moved!.id);
  useHoloStore.setState(initial,true); await initial.hydrateFromIndexedDb();
  assert.equal((await initial.mintCurrentCard())?.serialNumber,3);
});

test('canonical content accounts for every sticker transform, stacking, artwork, title, foil and design version', async () => {
  const hash = await buildMintIdempotencyKey(sample);
  assert.equal(hash, await buildMintIdempotencyKey(Object.fromEntries(Object.entries(sample).reverse()) as typeof sample));
  const [first,...others] = sample.stickers;
  assert.equal(hash, await buildMintIdempotencyKey({...sample,stickers:[{...first,x:first.x+1e-8},...others]}));
  for (const patch of [{ x:22 },{ y:50 },{ scale:1.5 },{ rotation:14 },{ zIndex:8 },{ stickerId:'crown' }]) {
    assert.notEqual(hash, await buildMintIdempotencyKey({...sample,stickers:[{...first,...patch},...others]}));
  }
  for (const patch of [{ title: 'test' },{ foil:'gold' },{ rarity:'LTD' },{ artId:'art' },
    { stickers:[...sample.stickers].reverse() },{ designVersion:2 }]) {
    assert.notEqual(hash,await buildMintIdempotencyKey({...sample,...patch}));
  }
});

test('pre-snapshot v2 localStorage migrates once with byte-identical backup; deletion persists', async () => {
  const { bars, liveFx, ...beatSnapshot } = sample.snapshot.beatSnapshot!;
  const old = { id:'legacy-42', code:'#MY-42', title:'Early work', foil:'gold', rarity:'UR',
    artId:sample.artId,sourceType:'beat',stickers:sample.stickers,waveformBars:sample.waveformBars,
    createdAt:sample.createdAt,beatSnapshot };
  const raw = JSON.stringify({state:{mintedCards:[old]}});
  mirror.set('holobeat-studio-v2',raw);
  const library = await holoDb.loadLibrary(seed);
  assert.equal(library.cards.length,1); assert.equal(library.cards[0].snapshot.beatSnapshot?.bars,1);
  assert.equal(library.cards[0].serialNumber,42); assert.equal(library.nextMintSerial,43);
  assert.equal(mirror.get('migration-backup:holobeat-studio-v2'),raw);
  await holoDb.saveMintedCards(seed,s=>({...s,cards:[]}));
  assert.deepEqual((await holoDb.loadLibrary(seed)).cards,[]);
  assert.equal(mirror.get('holobeat-studio-v2'),raw);
});

test('corrupt old data and serial collisions retain original data and prevent overwrite',async () => {
  const raw = JSON.stringify([sample,{...sample,id:'alternative-demo'}]);
  mirror.set('holobeat-minted-mirror-v3',raw);
  assert.equal((await holoDb.saveMintedCards(seed,s=>s)).status,'failed');
  assert.equal(mirror.get('holobeat-minted-mirror-v3'),raw);
  assert.equal(mirror.has('holobeat-library-v4'),false);
});

test('v1 IDB upgrade waits for old tab release, retires unversioned cache and keeps original rows', async () => {
  const old = await new Promise<IDBDatabase>((res,rej)=>{
    const req = indexedDB.open('HoloBeatStudioDB',1);
    req.onupgradeneeded=()=>{req.result.createObjectStore('kv');req.result.createObjectStore('audio_cache',{keyPath:'snapshotId'});};
    req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
  });
  await new Promise<void>((res,rej)=>{
    const tx=old.transaction(['kv','audio_cache'],'readwrite');
    tx.objectStore('kv').put([sample],'mintedCards');
    tx.objectStore('audio_cache').put({snapshotId:'old'});tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);
  });
  old.onversionchange=()=>old.close();
  assert.equal((await holoDb.loadLibrary(seed)).cards[0].id,sample.id);
  assert.equal(await holoDb.getAudioCache('old'),null);
});

test('corrupt project rejected; identical project imports deduplicate and preserve original', async () => {
  const envelope = { schema:'holobeat.project.v3' as const,kind:'minted-card' as const,exportedAt:Date.now(),card:sample };
  assert.equal(await initial.importProjectFile({...envelope,card:{...sample,waveformBars:[Infinity]}}),false);
  const original=JSON.stringify(sample);
  assert.equal(await initial.importProjectFile(envelope),true);
  assert.equal(await initial.importProjectFile(envelope),true);
  assert.equal(useHoloStore.getState().nextMintSerial,2);
  assert.equal(JSON.stringify(sample),original);
});


test('old tab blocking a version upgrade cannot silently initialize a second empty collection', async () => {
  const old = await new Promise<IDBDatabase>((res, rej) => {
    const req = indexedDB.open('HoloBeatStudioDB', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('kv'); req.result.createObjectStore('audio_cache', { keyPath:'snapshotId' }); };
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
  try {
    const result = await holoDb.saveMintedCards(seed, s => s);
    assert.equal(result.status, 'failed');
    assert.equal(mirror.has('holobeat-library-v4'), false);
  } finally {
    old.close();
    await new Promise(r => setTimeout(r, 20));
  }
  assert.equal((await holoDb.saveMintedCards(seed, s => s)).status, 'primary');
});

test('access-denied IndexedDB getter allows verified fallback', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable:true, get() {
    throw new DOMException('storage disabled', 'SecurityError');
  } });
  assert.equal((await holoDb.saveMintedCards(seed, s => s)).status, 'fallback');
});

test('independently edited stores preserve both heads and ask for conflict resolution', async () => {
  const offlineDb = indexedDB;
  const first = await holoDb.saveMintedCards(seed, () => ({ cards:[sample], nextMintSerial:2 }));
  assert.equal(first.status, 'primary');
  setDb(undefined); mirror.clear();
  assert.equal((await holoDb.saveMintedCards(seed, l => l)).status, 'fallback');
  const before = mirror.get('holobeat-library-v4');
  setDb(offlineDb);
  assert.equal((await holoDb.saveMintedCards(seed, l => l)).status,'failed');
  assert.equal(mirror.get('holobeat-library-v4'),before);
  mirror.clear();
  assert.equal((await holoDb.loadLibrary(seed)).cards[0].id,sample.id);
});

test('independent legacy collections with the same serial preserve both works and original backups', async () => {
  const current = {...sample, id:'a',code:'#MY-01',serialNumber:1};
  const previous = {...sample, id:'b',code:'#MY-01',serialNumber:1};
  const older = JSON.stringify({state:{mintedCards:[previous]}});
  mirror.set('holobeat-minted-mirror-v3',JSON.stringify([current]));
  mirror.set('holobeat-studio-v2',older);
  const lib = await holoDb.loadLibrary(seed);
  assert.deepEqual(lib.cards.map(c=>[c.id,c.code]),[['a','#MY-01'],['b','#MY-02']]);
  assert.equal(lib.nextMintSerial,3);
  assert.equal(mirror.get('migration-backup:holobeat-studio-v2'),older);
});

test('native V3 preserves independent A/B expressive cells and soundSeed through mint, reload and import', async () => {
  const snapshot = structuredClone(initial.forgeDraft.snapshot!);
  snapshot.id = 'expressive-fixture';
  const track = snapshot.beatSnapshot!.tracks[2];
  track.stepCells![19] = { on:true, velocity:0.731, pitchOffset:3, lengthSteps:4 };
  track.steps[19] = true;
  const draft = {...initial.forgeDraft,snapshot};
  useHoloStore.setState({forgeDraft:draft});
  const request = initial.createMintRequest()!;
  track.stepCells![19].velocity = 0.1;
  const result = await initial.commitMintRequest(request);
  assert.ok(result.card);
  assert.equal(result.card.snapshot.beatSnapshot!.tracks[2].stepCells![19].velocity,0.731);
  assert.equal(result.card.requestId,request.requestId);
  const repeat = await initial.commitMintRequest(request);
  assert.equal(repeat.card?.id,result.card.id);
  assert.equal(repeat.duplicate,true);
  const card = result.card;
  await initial.deleteMintedCard(card.id);
  useHoloStore.setState({ forgeDraft: initial.forgeDraft });
  assert.equal(await initial.importProjectFile({schema:'holobeat.project.v3',kind:'minted-card',exportedAt:Date.now(),card}),true);
  useHoloStore.setState(initial,true);await initial.hydrateFromIndexedDb();
  const imported = useHoloStore.getState().mintedCards[0];
  assert.deepEqual(imported.snapshot,card.snapshot);
  assert.equal(imported.snapshot.soundSeed,card.snapshot.soundSeed);
  assert.equal(imported.serialNumber,card.serialNumber+1);
});

test('failed commit retried with the same deliberate edit retains the initial requestId', async () => {
  const req=initial.createMintRequest()!;
  holoDb.setTestWriteFailureMode('all-fail');
  try { assert.equal((await initial.commitMintRequest(req)).card,null); }
  finally { holoDb.setTestWriteFailureMode('none'); }
  const retry=initial.createMintRequest()!;
  assert.notEqual(req.requestId,retry.requestId);
  const result=await initial.commitMintRequest(retry);
  assert.equal(result.card?.requestId,req.requestId);
  assert.equal(result.card?.serialNumber,1);
});

test('native v3 cards in database version 2 migrate without modifying A/B or the historical copy', async () => {
  const old = await new Promise<IDBDatabase>((resolve,reject) => {
    const req = indexedDB.open('HoloBeatStudioDB', 2);
    req.onupgradeneeded = () => { req.result.createObjectStore('kv'); req.result.createObjectStore('audio_cache', {keyPath:'snapshotId'}); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve,reject) => {
    const tx = old.transaction('kv','readwrite');
    tx.objectStore('kv').put([sample],'mintedCards'); tx.oncomplete = () => resolve(); tx.onerror=()=>reject(tx.error);
  });
  old.close();
  const current = await holoDb.loadLibrary(seed);
  assert.deepEqual(current.cards[0].snapshot,sample.snapshot);
  assert.equal(current.migrationReport?.cardCount,1);
  const upgraded = await new Promise<IDBDatabase>((resolve,reject) => {
    const req=indexedDB.open('HoloBeatStudioDB');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  try {
    assert.equal(upgraded.version,3);
    const original = await new Promise<unknown>((resolve,reject) => {
      const req=upgraded.transaction('kv').objectStore('kv').get('mintedCards');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    assert.deepEqual(original,[sample]);
  } finally { upgraded.close(); }
});

test('Forge import rejects reused snapshot id with different PCM inputs, even after its inspected card is removed', async () => {
  const snap = structuredClone(sample.snapshot);
  snap.id = 'fixture-existing-pcm';
  const card = { ...sample, snapshot:snap };
  const envelope = { schema:'holobeat.project.v3',kind:'minted-card',exportedAt:Date.now(),card };
  assert.equal(await initial.importProjectFile(envelope),true);
  const old = useHoloStore.getState().mintedCards[0];
  assert.equal(old.snapshot.id,snap.id);
  await initial.deleteMintedCard(old.id);
  const altered=structuredClone(snap);
  altered.events[0].velocity = altered.events[0].velocity === 0.1 ? 0.2 : 0.1;
  const draft = {...initial.forgeDraft,snapshot:altered};
  const draftEnvelope = {...envelope,kind:'forge-draft',draft};
  delete (draftEnvelope as Partial<typeof envelope>).card;
  assert.equal(await initial.importProjectFile(draftEnvelope),false);
  assert.match(useHoloStore.getState().toasts.at(-1)!.text,/快照编号/);
  assert.equal(await initial.importProjectFile({...envelope,card:{...card,snapshot:altered}}),false);
  assert.equal(await initial.importProjectFile({...envelope,card:{...card,title:'同曲异名'}}),true);
  assert.deepEqual(useHoloStore.getState().mintedCards[0].snapshot,snap);
});

test('shipped historic V3 showcase migrates without changing archive id, legacy request key, snapshots or A/B cells', async () => {
  const project = JSON.parse(readFileSync(new URL('../../07_showcase/exports/hutong-groove.holobeat.json',import.meta.url),'utf8'));
  const original = project.card;
  assert.equal(original.contentHash,undefined);
  mirror.set('holobeat-minted-mirror-v3',JSON.stringify([original]));
  const current = (await holoDb.loadLibrary(seed)).cards[0];
  assert.equal(current.id,original.id);
  assert.equal(current.idempotencyKey,original.idempotencyKey);
  assert.equal(current.contentHash,await buildMintIdempotencyKey(original));
  assert.equal(current.code,original.code);
  assert.deepEqual(current.snapshot,original.snapshot);
});
