import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const host = '127.0.0.1';
const probe = net.createServer();
await new Promise(resolve => probe.listen(0, host, resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const base = 'http://' + host + ':' + port;

const tmp = path.resolve('.cache', 'test-db');
mkdirSync(tmp, { recursive: true });
const dir = mkdtempSync(path.join(tmp, 'http-restart-'));
const dbPath = path.join(dir, 'fixture.sqlite');

async function start() {
  const proc = spawn(process.execPath, ['--experimental-strip-types', 'src/server.ts'], {
    env: { ...process.env, HOST: host, PORT: String(port), HOLOBEAT_DB_PATH: dbPath },
    windowsHide: true, stdio: ['ignore','pipe','pipe'],
  });
  let timer;
  try {
    await new Promise((resolve, reject) => {
      proc.once('error', reject);
      proc.once('exit', () => reject(Error('Service exited during startup')));
      proc.stdout.on('data', chunk => { if (chunk.toString().includes('listening on')) resolve(); });
      timer = setTimeout(() => reject(Error('Service startup timed out')), 15000);
    });
    return proc;
  } catch (error) {
    proc.kill();
    throw error;
  } finally { clearTimeout(timer); }
}
async function stop(proc) {
  const closed = once(proc, 'exit');
  proc.kill();
  await closed;
}

const snapshot = {
  id:'restart-snapshot', sourceType:'pinball', capturedAt:1, bpm:120, scale:'PENTA_C', durationMs:1000,
  pinballEvents:[{timeOffsetMs:0,cardId:'card-01',note:'C4',velocity:1,color:'#000000'}],
  events:[{id:'ev1',timeOffsetMs:0,durationMs:50,cardId:'card-01',trackCategory:'BEAT',
    trackIndex:0,pitch:'C4',color:'#000000',velocity:1}],
};
const card = {
  id:'restart-demo',serialNumber:1,code:'#MY-01',idempotencyKey:'restart-request',title:'Restart fixture',
  sourceType:'pinball',rarity:'UR',foil:'prism',artId:'neon-dj',snapshot,stickers:[],
  waveformBars:[0,0.5],audioFingerprintSeed:7,lineageDepth:0,createdAt:1,
};
const session = async () => (await (await fetch(base+'/api/session')).json()).writeToken;
const headers = token => ({'Content-Type':'application/json','X-HoloBeat-Write-Token':token});

async function verify() {
  let proc = await start();
  const firstPid = proc.pid;
  let oldToken, shareUrl;
  try {
    const health = await fetch(base+'/health');
    assert.equal(health.status,200);
    assert.equal((await health.json()).cardsCount,0);
    oldToken = await session();
    const post = (path, body) => fetch(base+path, {method:'POST',headers:headers(oldToken),body:JSON.stringify(body)});
    assert.equal((await post('/api/cards',card)).status,201);
    const share = await post('/api/shares',{cardId:card.id});
    assert.equal(share.status,201);
    shareUrl = (await share.json()).apiUrl;
    assert.equal((await fetch(shareUrl)).status,200);
  } finally { await stop(proc); }

  proc = await start();
  try {
    const res = await fetch(base+'/api/cards');
    assert.equal(res.status,200);
    assert.deepEqual((await res.json()).cards,[card]);
    const saved = await fetch(shareUrl);
    assert.equal(saved.status,200);
    assert.deepEqual((await saved.json()).card,card);
    const revoke = token => fetch(shareUrl,{method:'DELETE',headers:{'X-HoloBeat-Write-Token':token}});
    assert.equal((await revoke(oldToken)).status,403);
    assert.equal((await revoke(await session())).status,200);
    assert.equal((await fetch(shareUrl)).status,404);
    console.log(JSON.stringify({firstPid,restartedPid:proc.pid,port,restoredCards:1,
      exactPayload:true,oldSessionRejected:403,revokedShare:404}));
  } finally { await stop(proc); }
}
try { await verify(); }
finally { rmSync(dir,{recursive:true,force:true}); }
