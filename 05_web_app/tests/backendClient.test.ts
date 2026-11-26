import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { syncCardToBackend, revokeCardShare } from '../src/utils/backendClient.ts';
import type { MintedCard } from '../src/types/holo.ts';

const card = JSON.parse(readFileSync(new URL('../../07_showcase/exports/hutong-groove.holobeat.json',import.meta.url),'utf8')).card as MintedCard;
const json = (value: unknown, status = 200) => Response.json(value, { status });

test('local-only mode makes no requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch');
  assert.equal((await syncCardToBackend(card, { localOnly: true })).status, 'LOCAL_ONLY');
  assert.equal(fetch.mock.calls.length, 0);
});

test('archive confirmed, share rejected, retry reuses the same archive identity', async (t) => {
  const bodies: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    if (url.endsWith('/session')) return json({ writeToken: 'test-session' });
    assert.equal(new Headers(init.headers).get('X-HoloBeat-Write-Token'), 'test-session');
    if (url.endsWith('/cards')) {
      bodies.push(String(init.body));
      return json({ created: bodies.length === 1, card });
    }
    return json({ error: 'unavailable' }, 503);
  });
  const result = await syncCardToBackend(card);
  assert.equal(result.status,'SHARE_FAILED');
  assert.equal(result.ok,false);
  assert.equal(result.error,'作品已成功归档，但分享链接创建失败。');
  assert.equal((await syncCardToBackend(card, { share: false })).status, 'ARCHIVED');
  assert.deepEqual(bodies, [JSON.stringify(card), JSON.stringify(card)]);
});

test('invalid session, disconnected service and cancelled request have distinct errors', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => json({}));
  assert.equal((await syncCardToBackend(card) as {code:string}).code, 'BAD_RESPONSE');
  fetch.mock.mockImplementation(async () => { throw new TypeError('fetch failed'); });
  assert.equal((await syncCardToBackend(card) as {code:string}).code, 'NETWORK');
  assert.equal((await syncCardToBackend(card, { signal: AbortSignal.abort() }) as {code:string}).code, 'CANCELLED');
});

test('revoke requires a positive acknowledgement', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string) =>
    json(url.endsWith('/session') ? { writeToken: 'test-session' } : { revoked: true }));
  assert.equal((await revokeCardShare('fixture')).status, 'REVOKED');
});

test('transient archive failure retries the immutable payload once', async (t) => {
  let writes = 0;
  t.mock.method(globalThis,'fetch',async (url:string) => {
    if (url.endsWith('/session')) return json({writeToken:'test-session'});
    return ++writes === 1 ? json({},503) : json({created:false,card});
  });
  const outcome = await syncCardToBackend(card,{share:false});
  assert.equal(outcome.status,'ARCHIVED');
  assert.equal(writes,2);
});

test('hung service times out and cancels both bounded attempts', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let attempts = 0;
  t.mock.method(globalThis,'fetch',(_url:string,init:RequestInit) => new Promise((_resolve,reject) => {
    attempts++;
    init.signal!.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  }));
  const pending = syncCardToBackend(card);
  t.mock.timers.tick(5000);
  await new Promise<void>(resolve=>setImmediate(resolve));
  t.mock.timers.tick(5000);
  const result = await pending;
  assert.equal(result.status,'SYNC_FAILED');
  if (result.status==='SYNC_FAILED') assert.equal(result.code,'TIMEOUT');
  assert.equal(attempts,2);
});
