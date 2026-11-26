import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { holoDb } from '../src/storage/holoDb.ts';
import { validateProjectFile } from '../src/storage/schema.ts';

let loads = 0;
async function fresh() {
  return (await import(`../src/store/useHoloStore.ts?review=${++loads}`)).useHoloStore;
}
beforeEach(() => {
  const data = new Map<string,string>();
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(k:string)=>data.get(k)??null, setItem:(k:string,v:string)=>data.set(k,v), removeItem:(k:string)=>data.delete(k),
  }});
});
for (const defect of ['snapshot','pinballEvents','pinballScene','remixOrigin']) {
  test(`V2 rejects corrupt ${defect} before writes; valid draft survives reload`, async () => {
    const store = await fresh();
    store.getState().sendBeatToForge();
    const original = structuredClone(store.getState().forgeDraft);
    await holoDb.saveForgeDraft(original);
    const draft = structuredClone(original) as any;
    draft.snapshot.id = 'incoming-other';
    if (defect === 'snapshot') draft.snapshot = {id:'broken'};
    else if (defect === 'remixOrigin') draft.remixOrigin = {nonsense:true};
    else draft.snapshot[defect] = defect === 'pinballEvents' ? [{nonsense:true}] : {toys:'invalid'};
    const project = {schema:'holobeat.project.v2',kind:'forge-draft',exportedAt:Date.now(),draft};
    assert.equal(await store.getState().importProjectFile(project),false);
    assert.deepEqual(store.getState().forgeDraft,original);
    assert.deepEqual(await holoDb.loadForgeDraft(),original);
    const reload = await fresh();
    await reload.getState().hydrateFromIndexedDb();
    assert.deepEqual(reload.getState().forgeDraft,original);
  });
}
test('valid V2 empty draft remains importable; storage independently rejects invalid drafts',async()=>{
  const store = await fresh();
  const draft = structuredClone(store.getState().forgeDraft);
  draft.snapshot=null;
  assert.equal(validateProjectFile({schema:'holobeat.project.v2',kind:'forge-draft',exportedAt:Date.now(),draft}).ok,true);
  assert.equal((await holoDb.saveForgeDraft({...draft, snapshot:{id:'broken'} as any})).status,'failed');
});

test('theatre freezes remix origin; editor lineage and speed survive reload',async()=>{
  const store=await fresh();
  const origin={parentCardId:'A',parentCode:'#MY-01',parentTitle:'Original A',lineageDepth:2};
  store.setState({beatRemixOrigin:origin});
  store.getState().performBeatInPinball();
  store.setState({beatRemixOrigin:{...origin,parentCardId:'B',parentTitle:'Original B'}});
  store.getState().sendPinballShowToForge();
  assert.deepEqual(store.getState().forgeDraft.remixOrigin,origin);
  store.setState({beatRemixOrigin:origin,pinballRemixOrigin:origin,bpm:84});
  const restored=await fresh();
  assert.deepEqual(restored.getState().beatRemixOrigin,origin);
  assert.deepEqual(restored.getState().pinballRemixOrigin,origin);
  assert.equal(restored.getState().bpm,84);
  assert.deepEqual(restored.getState().pinballShowRemixOrigin,origin);
});
test('pinball unseal restores captured BPM rather than the current editor speed',async()=>{
  const store=await fresh();
  const snapshot={id:'pin-speed',sourceType:'pinball',capturedAt:100,bpm:84,scale:'PENTA_C',durationMs:1000,
    pinballEvents:[{timeOffsetMs:0,cardId:'card-01',note:'C4',velocity:1,color:'#000000'}],events:[]};
  store.setState({bpm:150,mintedCards:[{id:'A',code:'#MY-01',title:'A',sourceType:'pinball',lineageDepth:0,snapshot}]});
  store.getState().unsealAndRemixCard('A');
  assert.equal(store.getState().bpm,84);
});

test('unseal, edit, refresh, mint retains original parent and generation',async()=>{
  const store=await fresh();
  await store.getState().hydrateFromIndexedDb();
  store.getState().sendBeatToForge();
  const original=await store.getState().mintCurrentCard();
  assert.ok(original);
  store.getState().unsealAndRemixCard(original.id);
  store.getState().toggleStep(0,0,!store.getState().tracks[0].steps[0]);
  const restored=await fresh();
  await restored.getState().hydrateFromIndexedDb();
  restored.getState().sendBeatToForge();
  const remix=await restored.getState().mintCurrentCard();
  assert.ok(remix);
  assert.equal(remix.parentCardId,original.id);
  assert.equal(remix.parentCode,original.code);
  assert.equal(remix.lineageDepth,original.lineageDepth+1);
});
test('failed valid draft persistence leaves selection, serial, album and stored original intact',async()=>{
  const store=await fresh();
  await store.getState().hydrateFromIndexedDb();
  store.getState().sendBeatToForge();
  const original=structuredClone(store.getState().forgeDraft);
  await holoDb.saveForgeDraft(original);
  const before=store.getState();
  holoDb.setTestWriteFailureMode('all-fail');
  try{
    assert.equal(await store.getState().importProjectFile({schema:'holobeat.project.v2',kind:'forge-draft',
      exportedAt:Date.now(),draft:{...original,title:'Valid changed draft'}}),false);
    const after=store.getState();
    assert.deepEqual(after.forgeDraft,before.forgeDraft);
    assert.equal(after.inspectMintedId,before.inspectMintedId);
    assert.equal(after.nextMintSerial,before.nextMintSerial);
    assert.deepEqual(after.mintedCards,before.mintedCards);
    assert.deepEqual(await holoDb.loadForgeDraft(),original);
  }finally{holoDb.setTestWriteFailureMode('none');}
});

test('valid V2 music preserves supported BPM and explicit silent velocity',async()=>{
  const store=await fresh();
  store.setState({bpm:204});
  store.getState().sendBeatToForge();
  const draft=structuredClone(store.getState().forgeDraft);
  const snapshot=draft.snapshot!;
  const ratio=snapshot.bpm/204;
  snapshot.bpm=204;snapshot.beatSnapshot!.bpm=204;snapshot.durationMs=480000/204;
  snapshot.events.forEach(e=>{e.timeOffsetMs*=ratio;e.durationMs*=ratio;});
  snapshot.events[0].velocity=0;
  const result=validateProjectFile({schema:'holobeat.project.v2',kind:'forge-draft',exportedAt:Date.now(),draft});
  assert.equal(result.ok,true);
  assert.equal(result.project!.draft!.snapshot!.bpm,204);
  assert.equal(result.project!.draft!.snapshot!.events[0].velocity,0);
  assert.equal(result.project!.draft!.snapshot!.soundSeed,draft.snapshot!.soundSeed);
});
