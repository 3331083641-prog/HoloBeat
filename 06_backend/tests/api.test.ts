import vm from 'node:vm';
import { z } from 'zod';
import { createSchemas } from '../../shared/card-schema.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import { buildMintIdempotencyKey } from '../../shared/card-content.ts';
import { prepareDefaultDirectory } from '../src/archiveDirectory.ts';
import { ArchiveDatabase } from '../src/db.ts';
import { buildApp, listenOptions } from '../src/server.ts';

// Digests captured from the published v2.1 frontend canonicalization. These vectors
// must remain stable for clients syncing cards already minted in their browser.
const fixtureHashes = [
  'b959f8782a100c87f21df28ae646dd808b7c7d2eefcf42ffa794089fd6b9392d',
  '5097eee2103bc22b88729cf21fe5bee808676fd2a9248ce52a745200e3e57de1',
];
const makeCard = (n = 1) => ({
  id:'minted-' + n, serialNumber:n, code:'#MY-' + n, idempotencyKey:'request-' + n, requestId:'request-' + n,
  contentHash:fixtureHashes[n-1], designVersion:1,
  title:'测试 ' + n, rarity:'UR', foil:'prism', artId:'neon-dj', sourceType:'pinball',
  stickers:[], waveformBars:[0, 0.75], audioFingerprintSeed:1, lineageDepth:0, createdAt:100,
  snapshot:{ id:'snapshot-' + n, sourceType:'pinball', capturedAt:100, durationMs:1200,
    bpm:120, scale:'PENTA_C', pinballEvents:[{timeOffsetMs:0, cardId:'card-01',note:'C4',velocity:1,color:'#000000'}],
    events:[{id:'e',timeOffsetMs:0,durationMs:100,pitch:'C4',velocity:1,cardId:'card-01',
      trackCategory:'BEAT',trackIndex:0,color:'#000000'}] },
});
function tempDb(t: TestContext) {
  const base = process.env.HOLOBEAT_TEST_TMP ?? path.resolve('.cache','test-db');
  mkdirSync(base,{recursive:true});
  const dir = mkdtempSync(path.join(base,'hb-api-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  return path.join(dir,'archive.sqlite');
}
async function service(t: TestContext, dbPath=':memory:') {
  const app = await buildApp({dbPath});
  t.after(() => app.close());
  const session = await app.inject('/api/session');
  assert.equal(session.statusCode,200,session.body);
  const headers = {'x-holobeat-write-token':session.json().writeToken};
  const post = (url:string,payload:object) => app.inject({method:'POST',url,headers,payload});
  const del = (url:string) => app.inject({method:'DELETE',url,headers});
  const count = async () => (await app.inject('/api/health')).json().cardsCount;
  const save = async (n=1) => {
    const res = await post('/api/cards',makeCard(n));
    assert.equal(res.statusCode,201,res.body);
    return res.json().card;
  };
  const share = async (expiresAt?:number) => {
    const res = await post('/api/shares',{cardId:'minted-1',expiresAt});
    assert.equal(res.statusCode,201,res.body);
    return res.json().token as string;
  };
  return {app,post,del,count,save,share,headers};
}
test('health and empty fresh database',async t=>{
  const {app,count}=await service(t);
  const res=await app.inject('/health');
  assert.equal(res.statusCode,200);
  assert.equal(await count(),0);
});
test('valid card round trips in archive',async t=>{
  const {app,save,count}=await service(t);
  await save();
  assert.deepEqual((await app.inject('/api/cards')).json().cards,[makeCard()]);
  assert.equal(await count(),1);
});
test('same request is idempotent',async t=>{
  const {save,post,count}=await service(t);
  await save();
  const res=await post('/api/cards',makeCard());
  assert.equal(res.statusCode,200);
  assert.equal(res.json().created,false);
  assert.equal(await count(),1);
});
for(const [name,change] of Object.entries({
  key:{idempotencyKey:'request-1'}, request:{requestId:'request-1'}, id:{id:'minted-1'},
  serial:{serialNumber:1}, code:{code:'#MY-1'}, content:{contentHash:makeCard().contentHash},
})) test('conflicting '+name+' rolls back',async t=>{
  const {post,save,count,app}=await service(t);
  await save();
  const res=await post('/api/cards',{...makeCard(2),...change});
  assert.equal(res.statusCode,name === 'content' ? 400 : 409,res.body);
  assert.equal(await count(),1);
  assert.deepEqual((await app.inject('/api/cards')).json().cards,[makeCard()]);
});
for(const [name,change] of Object.entries({
  unknown:{extra:{arbitrary:true}}, type:{serialNumber:'1'}, missing:{snapshot:null},
  largeArray:{waveformBars:new Array(513).fill(0)}, negative:{snapshot:{...makeCard().snapshot,durationMs:-1}},
  resource:{artId:'data:image/png;base64,data'}, invalidNote:{snapshot:{...makeCard().snapshot,
    events:[{...makeCard().snapshot.events[0],pitch:'not-a-pitch'}]}}, origin:{sourceType:'beat'},
  lineage:{parentCardId:'missing'}, malformedBeat:{sourceType:'beat',snapshot:{...makeCard().snapshot,
    sourceType:'beat',beatSnapshot:{bars:1,tracks:[]}}},
})) test('invalid '+name+' returns 400 and never inserts',async t=>{
  const {post,count}=await service(t);
  const res=await post('/api/cards',{...makeCard(),...change});
  assert.equal(res.statusCode,400,res.body);
  assert.equal(await count(),0);
});
test('a syntactically valid but incorrect digest cannot reserve a hash or insert a row',async t=>{
  const {post,save,count}=await service(t);
  const res=await post('/api/cards',{...makeCard(),title:'Changed after hashing'});
  assert.equal(res.statusCode,400);
  assert.equal(res.json().code,'CONTENT_HASH_MISMATCH');
  assert.equal(await count(),0);
  await save();
  assert.equal(await count(),1);
});
test('versioned request needs a digest, legacy archive and retry remain valid',async t=>{
  const {post,count}=await service(t);
  const {contentHash,designVersion,requestId,...legacyCard}=makeCard();
  assert.equal((await post('/api/cards',{...legacyCard,designVersion,requestId})).statusCode,400);
  assert.equal(await count(),0);
  assert.equal((await post('/api/cards',legacyCard)).statusCode,201);
  assert.equal((await post('/api/cards',legacyCard)).statusCode,200);
  assert.equal(await count(),1);
});
test('oversized body rejected before persistence',async t=>{
  const {post,count}=await service(t);
  assert.equal((await post('/api/cards',{title:'x'.repeat(1024*1024)})).statusCode,413);
  assert.equal(await count(),0);
});
test('delete original without descendants invalidates existing link',async t=>{
  const {app,save,share,del,count}=await service(t);
  await save();
  const token=await share();
  assert.equal((await del('/api/cards/minted-1')).statusCode,200);
  assert.equal((await app.inject('/api/shares/'+token)).statusCode,404);
  assert.equal(await count(),0);
});
const child={...makeCard(2),contentHash:'a46143fa54bd15920a0ae2ace1dfba3578f8122967f12211fdf8cae331bab2f4',parentCardId:'minted-1',parentTitle:makeCard().title,parentCode:'#MY-1',lineageDepth:1};
test('lineage has exact parent and child',async t=>{
  const {save,post,app,count}=await service(t);
  assert.equal((await post('/api/cards',child)).statusCode,409);
  await save();
  assert.equal((await post('/api/cards',child)).statusCode,201);
  assert.deepEqual((await app.inject('/api/lineage/minted-2')).json().ancestors,[makeCard()]);
  assert.deepEqual((await app.inject('/api/lineage/minted-1')).json().children,[child]);
  assert.equal(await count(),2);
});
test('parent with children is protected',async t=>{
  const {save,post,del,count}=await service(t);
  await save();
  assert.equal((await post('/api/cards',child)).statusCode,201);
  assert.equal((await del('/api/cards/minted-1')).statusCode,409);
  assert.equal(await count(),2);
});
test('share creation reuses active link with same expiry',async t=>{
  const {save,post,share,count}=await service(t);
  await save();
  const token=await share();
  const res=await post('/api/shares',{cardId:'minted-1'});
  assert.equal(res.statusCode,200);
  assert.equal(res.json().token,token);
  assert.equal(await count(),1);
});
test('share GET is read only',async t=>{
  const {save,share,app,count}=await service(t);
  await save();
  const url='/api/shares/'+await share();
  const res=await app.inject(url);
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.json().card,makeCard());
  assert.equal((await app.inject({method:'DELETE',url})).statusCode,403);
  assert.equal((await app.inject(url)).statusCode,200);
  assert.equal(await count(),1);
});
test('share revocation immediate',async t=>{
  const {save,share,del,app,count}=await service(t);
  await save();
  const url='/api/shares/'+await share();
  assert.equal((await del(url)).statusCode,200);
  assert.equal((await app.inject(url)).statusCode,404);
  assert.equal(await count(),1);
});
test('expiry and expiry changes invalidate old links',async t=>{
  const {save,share,post,app,count}=await service(t);
  await save();
  const old=await share();
  t.mock.timers.enable({apis:['Date'],now:Date.now()});
  const expiresAt=Date.now()+10000;
  const current=await share(expiresAt);
  assert.equal((await app.inject('/api/shares/'+old)).statusCode,404);
  assert.equal((await app.inject('/api/shares/'+current)).statusCode,200);
  t.mock.timers.tick(10000);
  assert.equal((await app.inject('/api/shares/'+current)).statusCode,404);
  assert.equal((await post('/api/shares',{cardId:'minted-1',expiresAt})).statusCode,400);
  assert.equal(await count(),1);
});
test('concurrent retry yields one row and one active link',async t=>{
  const {post,count}=await service(t);
  for(const [url,payload] of [['/api/cards',makeCard()],['/api/shares',{cardId:'minted-1'}]] as const){
    const res=await Promise.all(Array.from({length:12},()=>post(url,payload)));
    assert.equal(res.filter(r=>r.statusCode===201).length,1);
    assert.equal(res.filter(r=>r.statusCode===200).length,11);
    if(url.endsWith('shares')) assert.equal(new Set(res.map(r=>r.json().token)).size,1);
  }
  assert.equal(await count(),1);
});
test('browser origin, host, client address and writes restricted',async t=>{
  const {app,headers,count}=await service(t);
  for (const options of [{headers:{origin:'https://example.invalid'}},{headers:{host:'example.invalid'}},
      {remoteAddress:'192.0.2.1'}]) assert.equal((await app.inject({url:'/api/session',...options})).statusCode,403);
  assert.equal((await app.inject({url:'/api/cards',method:'POST',payload:makeCard()})).statusCode,403);
  assert.equal((await app.inject({url:'/api/cards',method:'POST',headers:{...headers,origin:'null'},payload:makeCard()})).statusCode,403);
  assert.equal(await count(),0);
  assert.throws(()=>listenOptions({HOST:'0.0.0.0'}));
  assert.throws(()=>listenOptions({PORT:'0'}));
});
const legacySql=readFileSync(new URL('./schema-v0.sql',import.meta.url),'utf8');
function legacy(file:string, cards = [makeCard()]) {
  const db=new DatabaseSync(file);
  db.exec(legacySql);
  for(const c of cards) db.prepare(`INSERT INTO minted_cards(id,serial_number,code,idempotency_key,title,rarity,foil,art_id,
    source_type,is_demo,lineage_depth,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(c.id,c.serialNumber,c.code,c.idempotencyKey,c.title,c.rarity,c.foil,c.artId,c.sourceType,0,0,JSON.stringify(c),c.createdAt);
  db.exec("INSERT INTO share_links(token,card_id,created_at) VALUES ('old-link','minted-1',100)");
  db.close();
}
test('v0 upgrade, repeat migration and restart preserve payload and share',t=>{
  const file=tempDb(t);
  legacy(file);
  for(let pass=0;pass<2;pass++){
    const archive=new ArchiveDatabase(file);
    assert.equal(archive.countCards(),1);
    assert.deepEqual(archive.getSharedCard('old-link')?.card,makeCard());
    archive.close();
    archive.close();
  }
  const db=new DatabaseSync(file);
  assert.equal(db.prepare('PRAGMA user_version').get()?.user_version,3);
  db.close();
  const backups=readdirSync(path.dirname(file)).filter(n=>n.includes('.pre-v3-'));
  assert.equal(backups.length,1);
  const backup=new DatabaseSync(path.join(path.dirname(file),backups[0]));
  assert.equal(backup.prepare('PRAGMA user_version').get()?.user_version,0);
  backup.close();
});
test('failed migration rolls back DDL, retains original rows and can retry',t=>{
  const file=tempDb(t);
  legacy(file,[makeCard(),{...makeCard(2),serialNumber:1}]);
  assert.throws(()=>new ArchiveDatabase(file));
  const db=new DatabaseSync(file);
  assert.equal(db.prepare('PRAGMA user_version').get()?.user_version,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM minted_cards').get()?.n,2);
  assert.equal(db.prepare('PRAGMA table_info(share_links)').all().some(c=>c.name==='expires_at'),false);
  // Simulate explicit operator repair on this disposable fixture.
  db.prepare('UPDATE minted_cards SET serial_number=2 WHERE id=?').run('minted-2');
  db.close();
  const archive=new ArchiveDatabase(file);
  assert.equal(archive.countCards(),2);
  archive.close();
});
test('damaged SQLite is not replaced',t=>{
  const file=tempDb(t);
  writeFileSync(file,'damaged fixture');
  assert.throws(()=>new ArchiveDatabase(file));
  assert.equal(readFileSync(file,'utf8'),'damaged fixture');
});
test('malformed stored JSON prevents v0 migration without losing original',t=>{
  const file=tempDb(t);
  legacy(file);
  const db=new DatabaseSync(file);
  db.exec("UPDATE minted_cards SET payload_json='{'");
  db.close();
  assert.throws(()=>new ArchiveDatabase(file));
  const old=new DatabaseSync(file);
  assert.equal(old.prepare('SELECT payload_json FROM minted_cards').get()?.payload_json,'{');
  assert.equal(old.prepare('PRAGMA user_version').get()?.user_version,0);
  old.close();
});
test('locked SQLite rejects writes, returns 503 and permits retry',async t=>{
  const file=tempDb(t);
  const {app,post,count}=await service(t,file);
  const db=new DatabaseSync(file);
  try {
    db.exec('BEGIN IMMEDIATE');
    const res=await post('/api/cards',makeCard());
    assert.equal(res.statusCode,503,res.body);
    assert.equal(await count(),0);
    db.exec('ROLLBACK');
    assert.equal((await post('/api/cards',makeCard())).statusCode,201);
  } finally { db.close(); await app.close(); }
});
test('interrupted migration process leaves old schema recoverable',t=>{
  const file=tempDb(t);
  legacy(file);
  const script = `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);
    db.exec('BEGIN IMMEDIATE; ALTER TABLE share_links ADD COLUMN expires_at INTEGER; PRAGMA user_version=2');
    process.exit(37);`;
  const child=spawnSync(process.execPath,['-e',script,file]);
  assert.equal(child.status,37);
  const old=new DatabaseSync(file);
  assert.equal(old.prepare('PRAGMA user_version').get()?.user_version,0);
  old.close();
  const archive=new ArchiveDatabase(file);
  assert.deepEqual(archive.getSharedCard('old-link')?.card,makeCard());
  archive.close();
});

test('new default archive directory can store and reopen an archive', t => {
  const parent = path.dirname(tempDb(t));
  const directory = path.join(parent,'data');
  prepareDefaultDirectory(directory);
  prepareDefaultDirectory(directory);
  const file = path.join(directory, 'local.sqlite');
  const store = new ArchiveDatabase(file);
  assert.equal(store.countCards(), 0);
  store.close();
  if (process.platform === 'win32') {
    const probe = spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      "$acl=[System.IO.Directory]::GetAccessControl($env:HB_ACL_TEST); if (!$acl.AreAccessRulesProtected) {exit 1}; foreach($ace in $acl.Access) { if ($ace.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -in @('S-1-1-0','S-1-5-11','S-1-5-32-545')) {exit 2} }"],
      {windowsHide:true,env:{...process.env,HB_ACL_TEST:directory}});
    assert.equal(probe.status,0);
  }
});

const showcaseProject = JSON.parse(readFileSync(new URL('../../07_showcase/exports/hutong-groove.holobeat.json', import.meta.url),'utf8'));
test('shipped V3 work round trips all authoring data through archive, read-only HTML and JSON',async t=>{
  const {post,app,del,count}=await service(t);
  const card={...showcaseProject.card,title:'《河岸》 <声卡> & "铜铃"'};
  assert.equal(showcaseProject.schema,'holobeat.project.v3');
  for(const track of card.snapshot.beatSnapshot.tracks) assert.equal(track.stepCells.length,32);
  const save=await post('/api/cards',card);
  assert.equal(save.statusCode,201,save.body);
  assert.deepEqual(save.json().card,card);
  const link=await post('/api/shares',{cardId:card.id});
  assert.equal(link.statusCode,201,link.body);
  const htmlUrl=new URL(link.json().shareUrl).pathname;
  const apiUrl=new URL(link.json().apiUrl).pathname;
  assert.equal(htmlUrl,'/share/'+link.json().token);
  assert.equal(apiUrl,'/api/shares/'+link.json().token);
  const html=await app.inject(htmlUrl);
  assert.equal(html.statusCode,200);
  assert.match(String(html.headers['content-type']),/^text\/html/);
  assert.match(html.body,/&lt;声卡&gt; &amp; &quot;铜铃&quot;/);
  assert.doesNotMatch(html.body,/<声卡>/);
  assert.match(html.body,/只读作品展页/);
  const embedded=html.body.match(/const PROJECT_DATA = (.+);/);
  assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded[1]).card,card);
  assert.deepEqual((await app.inject(apiUrl)).json().card,card);
  assert.equal((await del(apiUrl)).statusCode,200);
  assert.equal((await app.inject(apiUrl)).statusCode,404);
  assert.equal((await app.inject(htmlUrl)).statusCode,404);
  assert.equal(await count(),1);
});
test('V3 expressive step validation rejects malformed nested cells',async t=>{
  const {post,count}=await service(t);
  const card=structuredClone(showcaseProject.card);
  card.snapshot.beatSnapshot.tracks[0].stepCells[0].lengthSteps=7;
  assert.equal((await post('/api/cards',card)).statusCode,400);
  assert.equal(await count(),0);
});
test('V3 single phrase audition of two bars accepts its one-bar effective duration',async t=>{
  const {post,count}=await service(t);
  const card=structuredClone(showcaseProject.card);
  card.snapshot.beatSnapshot.activePhraseLoop='A';
  card.snapshot.bars=1;
  card.snapshot.durationMs=Math.round(240000/card.snapshot.bpm);
  card.snapshot.events=card.snapshot.events.filter(e=>e.timeOffsetMs<card.snapshot.durationMs);
  assert.equal((await post('/api/cards',card)).statusCode,201);
  assert.equal(await count(),1);
});
test('configured credentials remain private and authorize legacy header and session issuance',async t=>{
  const key='local-test-credential';
  const app=await buildApp({dbPath:':memory:',writeToken:key});
  t.after(()=>app.close());
  assert.equal((await app.inject('/api/session')).statusCode,401);
  const headers={'x-holobeat-token':key};
  const result=await app.inject({url:'/api/session',headers});
  assert.equal(result.statusCode,200);
  assert.notEqual(result.json().writeToken,key);
  const saved=await app.inject({url:'/api/cards',method:'POST',headers,payload:makeCard()});
  assert.equal(saved.statusCode,201,saved.body);
  assert.equal((await app.inject('/api/health')).json().cardsCount,1);
});
test('loopback write quota is shared by session and scoped to one server instance',async t=>{
  const {post,count}=await service(t);
  for(let n=0;n<60;n++) assert.equal((await post('/api/shares',{cardId:'missing'})).statusCode,404);
  assert.equal((await post('/api/cards',makeCard())).statusCode,429);
  assert.equal(await count(),0);
});

test('old V3 archive is replayable after the browser computes a digest and refreshes its PCM',async t=>{
  const {app,post,count}=await service(t);
  const archived=structuredClone(showcaseProject.card);
  archived.storageStatus='fallback';
  archived.waveformIsRealPcm=false;
  const original=await post('/api/cards',archived);
  assert.equal(original.statusCode,201);
  const incoming={...archived,storageStatus:'primary',waveformIsRealPcm:true,waveformBars:[0.1,0.8],
    contentHash:await buildMintIdempotencyKey(archived)};
  const replay=await post('/api/cards',incoming);
  assert.equal(replay.statusCode,200,replay.body);
  assert.equal(replay.json().created,false);
  assert.deepEqual(replay.json().card,archived);
  const changed={...incoming,foil:'gold'};
  changed.contentHash=await buildMintIdempotencyKey(changed);
  assert.equal((await post('/api/cards',changed)).statusCode,409);
  assert.equal(await count(),1);
  assert.deepEqual((await app.inject('/api/cards')).json().cards,[archived]);
});
test('archive created by the old field-stripping V3 writer recognizes the original local work',async t=>{
  const full=structuredClone(showcaseProject.card);
  const file=tempDb(t);
  const stored=structuredClone(full);
  for(const key of ['capturedAt','rendererVersion','assetVersion','soundSeed','pinballEvents','pinballScene'])
    delete stored.snapshot[key];
  for(const e of stored.snapshot.events) for(const key of ['sourceX','sourceY','color']) delete e[key];
  const db=new DatabaseSync(file);
  db.exec(legacySql);
  db.prepare(`INSERT INTO minted_cards(id,serial_number,code,idempotency_key,title,rarity,foil,art_id,
    source_type,is_demo,lineage_depth,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    stored.id,stored.serialNumber,stored.code,stored.idempotencyKey,stored.title,stored.rarity,stored.foil,
    stored.artId,stored.sourceType,0,0,JSON.stringify(stored),stored.createdAt);
  db.close();
  const {app,post,count}=await service(t,file);
  try {
    const response=await post('/api/cards',{...full,contentHash:await buildMintIdempotencyKey(full)});
    assert.equal(response.statusCode,200,response.body);
    assert.deepEqual(response.json().card,stored);
    assert.equal(await count(),1);
    const share=await post('/api/shares',{cardId:stored.id});
    const url='/share/'+share.json().token;
    const raw=await app.inject(url);
    assert.match(raw.body,/holobeat.raw-archive.v1/);
    assert.match(raw.body,/不能完整重混/);
    assert.equal((await post('/api/cards/'+full.id+'/repair',{...full,title:'forged'})).statusCode,409);
    const repaired=await post('/api/cards/'+full.id+'/repair',full);
    assert.equal(repaired.statusCode,200,repaired.body);
    const page=await app.inject(url);
    const project=JSON.parse(page.body.match(/const PROJECT_DATA = (.*);/)![1]);
    assert.equal(createSchemas(z).ProjectSchema.safeParse(project).success,true);
    assert.deepEqual(project.card,full);
    const inspect=new DatabaseSync(file);
    const audit=inspect.prepare('SELECT * FROM archive_repairs').get()!;
    assert.deepEqual(JSON.parse(String(audit.original_json)),stored);
    assert.deepEqual(JSON.parse(String(audit.repaired_json)),full);
    assert.equal(inspect.prepare('PRAGMA user_version').get()?.user_version,3);
    inspect.close();

  } finally { await app.close(); }
});

test('case-only title edits produce distinct content and independently archived works',async t=>{
  const {app,post,count}=await service(t);
  // The music, sticker layout and design are identical, including the frozen snapshot.
  const first={...makeCard(),title:'Beat'};
  const second={...first,id:'variant',requestId:'case-2',idempotencyKey:'case-2',
    serialNumber:2,code:'#MY-2',title:'beat'};
  first.contentHash=await buildMintIdempotencyKey(first);
  second.contentHash=await buildMintIdempotencyKey(second);
  assert.notEqual(first.contentHash,second.contentHash);
  assert.equal((await post('/api/cards',first)).statusCode,201);
  assert.equal((await post('/api/cards',second)).statusCode,201);
  assert.equal((await post('/api/cards',first)).statusCode,200);
  assert.equal(await count(),2);
  assert.deepEqual((await app.inject('/api/cards')).json().cards.map(c=>c.title).sort(),['Beat','beat']);
  assert.equal(await buildMintIdempotencyKey({...first,title:'  B\u00e9at  '}),
    await buildMintIdempotencyKey({...first,title:'Be\u0301at'}));
});
test('legacy V3 preserves its old idempotency key on replay after hashing a mixed-case title',async t=>{
  const {app,post,count}=await service(t);
  const card={...showcaseProject.card,title:'Beat',idempotencyKey:'old::BEAT::prism'};
  assert.equal((await post('/api/cards',card)).statusCode,201);
  const replay=await post('/api/cards',{...card,contentHash:await buildMintIdempotencyKey(card)});
  assert.equal(replay.statusCode,200,replay.body);
  assert.equal(replay.json().card.idempotencyKey,card.idempotencyKey);
  assert.equal(await count(),1);
  assert.deepEqual((await app.inject('/api/cards')).json().cards,[card]);
});

test('independent library namespaces can both archive their number one',async t=>{
  const {post,count}=await service(t);
  const a={...makeCard(),libraryId:'book-a'};
  const b={...makeCard(2),serialNumber:1,code:a.code,libraryId:'book-b'};
  assert.equal((await post('/api/cards',a)).statusCode,201);
  assert.equal((await post('/api/cards',b)).statusCode,201);
  assert.equal(await count(),2);
});
test('downloaded work restores canonical archive identity and binds retry receipt',async t=>{
  const {post,count,app}=await service(t);
  const a=makeCard();
  await post('/api/cards',a);
  const b={...a,id:'import-copy',serialNumber:9,code:'#MY-09',libraryId:'other',
    requestId:'import-request',idempotencyKey:'import-request',createdAt:200};
  const restored=await post('/api/cards',b);
  assert.equal(restored.statusCode,200,restored.body);
  assert.equal(restored.json().outcome,'RESTORED');
  assert.equal(restored.json().canonicalId,a.id);
  assert.equal(await count(),1);
  const link=await post('/api/shares',{cardId:restored.json().canonicalId});
  assert.equal(link.statusCode,201);
  assert.equal((await app.inject('/api/shares/'+link.json().token)).json().card.id,a.id);
  const changed={...b,title:'Different',id:'different',contentHash:''};
  changed.contentHash=await buildMintIdempotencyKey(changed);
  assert.equal((await post('/api/cards',changed)).statusCode,409);
  assert.equal(await count(),1);
});
test('missing and incompatible ancestors return actionable errors without inserting',async t=>{
  const {post,count}=await service(t);
  const child={...makeCard(2),parentCardId:'minted-1',parentCode:'#MY-1',parentTitle:'测试 1',lineageDepth:1};
  child.contentHash=await buildMintIdempotencyKey(child);
  const missing=await post('/api/cards',child);
  assert.equal(missing.statusCode,409);
  assert.equal(missing.json().code,'MISSING_PARENT');
  await post('/api/cards',makeCard());
  const wrong=await post('/api/cards',{...child,parentTitle:'Wrong'});
  assert.equal(wrong.statusCode,409);
  assert.equal(wrong.json().code,'PARENT_METADATA_CONFLICT');
  assert.equal(await count(),1);
  assert.equal((await post('/api/cards',child)).statusCode,201);
});

test('share contour has correct octaves/accidentals, zero is silent and stop releases nodes',async t=>{
  const {post,app}=await service(t);
  const card=makeCard();
  card.snapshot.events.push({...card.snapshot.events[0],id:'silent',velocity:0});
  card.contentHash=await buildMintIdempotencyKey(card);
  await post('/api/cards',card);
  const share=await post('/api/shares',{cardId:card.id});
  const html=(await app.inject('/share/'+share.json().token)).body;
  const callbacks:Record<string,Function>={};
  const nodes:any[]=[]; const contexts:any[]=[];
  class AudioContext {
    currentTime=0; state='running'; destination={}; closed=false;
    constructor(){contexts.push(this);}
    createOscillator(){const n={frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
      connect(){},start(){},stop(){n.stopped=true;},disconnect(){n.disconnected=true;},stopped:false,disconnected:false}; nodes.push(n);return n;}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
    async close(){this.closed=true;}
  }
  const context=vm.createContext({document:{hidden:false,getElementById:(id:string)=>({
    addEventListener:(_type:string,fn:Function)=>callbacks[id]=fn,textContent:''}),
    addEventListener:(type:string,fn:Function)=>callbacks[type]=fn},
    window:{AudioContext,addEventListener:(type:string,fn:Function)=>callbacks[type]=fn},
    setTimeout:()=>1,clearTimeout(){}});
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)![1],context);
  for(const [note,hz] of [['C4',261.625565],['A4',440],['F#4',369.994423],['Bb4',466.163762]] as const)
    assert.ok(Math.abs(vm.runInContext(`noteToHz('${note}')`,context)-hz)<0.0001);
  await callbacks.playBtn();
  assert.equal(nodes.length,1,'velocity zero must create no oscillator');
  await callbacks.playBtn();
  assert.ok(nodes.every(n=>n.stopped&&n.disconnected));
  assert.ok(contexts.every(c=>c.closed));
  await callbacks.playBtn();
  callbacks.pagehide();
  assert.ok(contexts.every(c=>c.closed));
});

test('v2 upgrade retains old namespace numbers, raw payload and existing share across restart',async t=>{
  const file=tempDb(t);
  const {app,post}=await service(t,file);
  await post('/api/cards',makeCard());
  const link=(await post('/api/shares',{cardId:'minted-1'})).json();
  await app.close();
  const old=new DatabaseSync(file);
  old.exec(`DROP INDEX uq_archive_library_serial; DROP INDEX uq_archive_library_code;
    CREATE UNIQUE INDEX uq_archive_serial ON minted_cards(serial_number);
    CREATE UNIQUE INDEX uq_archive_code ON minted_cards(code);
    PRAGMA user_version=2;`);
  old.close();
  for(let i=0;i<2;i++){
    const next=await buildApp({dbPath:file});
    assert.deepEqual((await next.inject('/api/shares/'+link.token)).json().card,makeCard());
    assert.equal((await next.inject('/health')).json().cardsCount,1);
    await next.close();
  }
  const db=new DatabaseSync(file);
  assert.equal(db.prepare('PRAGMA user_version').get()?.user_version,3);
  assert.deepEqual(JSON.parse(String(db.prepare('SELECT payload_json FROM minted_cards').get()?.payload_json)),makeCard());
  db.close();
});
