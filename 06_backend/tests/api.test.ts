import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/server.ts';

const sampleCard = {
  id: 'minted-test-001',
  schemaVersion: 3,
  serialNumber: 1,
  code: '#MY-01',
  idempotencyKey: 'snap-1::TEST::UR::prism::bamboo-cat::stk-hash',
  title: '清晨弄堂测试',
  rarity: 'UR' as const,
  foil: 'prism' as const,
  artId: 'bamboo-cat',
  sourceType: 'beat' as const,
  isDemo: false,
  stickers: [
    { uid: 's1', stickerId: 'clapper', x: 24, y: 30, scale: 1, rotation: -8, zIndex: 1 },
  ],
  waveformBars: [0.4, 0.8, 0.5, 0.9],
  waveformIsRealPcm: true,
  snapshot: {
    id: 'snap-test-1',
    schemaVersion: 3,
    sourceType: 'beat' as const,
    title: '清晨弄堂测试',
    bpm: 116,
    swing: 0.16,
    scale: 'PENTA_C' as const,
    bars: 2 as const,
    durationMs: 4138,
    events: [
      {
        id: 'ev-1',
        timeOffsetMs: 0,
        durationMs: 129,
        trackIndex: 0,
        trackCategory: 'BEAT' as const,
        cardId: 'card-01',
        pitch: 'C3',
        velocity: 0.9,
      },
    ],
    createdAt: Date.now(),
  },
  lineageDepth: 0,
  createdAt: Date.now(),
};

test('HoloBeat Archive Backend: health, idempotent save, lineage, HTML share page & revocation', async () => {
  const app = await buildApp({ dbPath: ':memory:' });

  const healthRes = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(healthRes.statusCode, 200);
  assert.equal(healthRes.json().ok, true);

  // Save card once -> 201 created
  const create1 = await app.inject({ method: 'POST', url: '/api/cards', payload: sampleCard });
  assert.equal(create1.statusCode, 201);
  assert.equal(create1.json().created, true);

  // Duplicate idempotencyKey -> 200 idempotent (zero duplicate rows!)
  const create2 = await app.inject({ method: 'POST', url: '/api/cards', payload: sampleCard });
  assert.equal(create2.statusCode, 200);
  assert.equal(create2.json().created, false);

  // Child remix card -> verify lineage graph
  const childCard = {
    ...sampleCard,
    id: 'minted-test-002',
    serialNumber: 2,
    code: '#MY-02',
    idempotencyKey: 'snap-2::REMIX::UR::gold::street-bell::stk-hash',
    title: '胡同变奏曲',
    parentCardId: sampleCard.id,
    parentCode: sampleCard.code,
    parentTitle: sampleCard.title,
    lineageDepth: 1,
  };
  const createChild = await app.inject({ method: 'POST', url: '/api/cards', payload: childCard });
  assert.equal(createChild.statusCode, 201);

  const lineageRes = await app.inject({ method: 'GET', url: `/api/lineage/${childCard.id}` });
  assert.equal(lineageRes.statusCode, 200);
  assert.equal(lineageRes.json().ancestors.length, 1);
  assert.equal(lineageRes.json().ancestors[0].id, sampleCard.id);

  // Share token creation -> returns BOTH human-readable HTML shareUrl & JSON apiUrl
  const shareRes = await app.inject({
    method: 'POST',
    url: '/api/shares',
    payload: { cardId: sampleCard.id },
  });
  assert.equal(shareRes.statusCode, 201);
  const { token, shareUrl, apiUrl } = shareRes.json();
  assert.ok(shareUrl.endsWith(`/share/${token}`), 'shareUrl must point to /share/:token HTML showcase');
  assert.ok(apiUrl.endsWith(`/api/shares/${token}`), 'apiUrl must point to JSON API');

  // Read-only HTML showcase page renders cleanly
  const htmlPage = await app.inject({ method: 'GET', url: `/share/${token}` });
  assert.equal(htmlPage.statusCode, 200);
  assert.match(String(htmlPage.headers['content-type']), /text\/html/);
  assert.match(htmlPage.body, /清晨弄堂测试/);
  assert.match(htmlPage.body, /只读作品展页/);
  assert.match(htmlPage.body, /\.holobeat\.json/);

  // JSON API still works cleanly
  const fetchShared = await app.inject({ method: 'GET', url: `/api/shares/${token}` });
  assert.equal(fetchShared.statusCode, 200);
  assert.equal(fetchShared.json().card.code, '#MY-01');

  // Revocation blocks BOTH JSON API and HTML showcase page
  const revokeRes = await app.inject({ method: 'DELETE', url: `/api/shares/${token}` });
  assert.equal(revokeRes.statusCode, 200);

  const fetchRevokedJson = await app.inject({ method: 'GET', url: `/api/shares/${token}` });
  assert.equal(fetchRevokedJson.statusCode, 404);

  const fetchRevokedHtml = await app.inject({ method: 'GET', url: `/share/${token}` });
  assert.equal(fetchRevokedHtml.statusCode, 404);
  assert.match(fetchRevokedHtml.body, /已失效/);

  await app.close();
});

test('HoloBeat Archive Backend: strict nested schema rejects invalid BPM, stickers, and events', async () => {
  const app = await buildApp({ dbPath: ':memory:' });

  // Invalid BPM (9999) inside nested snapshot
  const badBpmRes = await app.inject({
    method: 'POST',
    url: '/api/cards',
    payload: {
      ...sampleCard,
      id: 'bad-bpm',
      idempotencyKey: 'bad-bpm-key',
      snapshot: { ...sampleCard.snapshot, bpm: 9999 },
    },
  });
  assert.equal(badBpmRes.statusCode, 400);

  // Invalid sticker coordinates (x = 999)
  const badStickerRes = await app.inject({
    method: 'POST',
    url: '/api/cards',
    payload: {
      ...sampleCard,
      id: 'bad-sticker',
      idempotencyKey: 'bad-sticker-key',
      stickers: [{ uid: 'x', stickerId: 'clapper', x: 999, y: 50, scale: 1, rotation: 0 }],
    },
  });
  assert.equal(badStickerRes.statusCode, 400);

  // Invalid event velocity (> 1)
  const badEventRes = await app.inject({
    method: 'POST',
    url: '/api/cards',
    payload: {
      ...sampleCard,
      id: 'bad-event',
      idempotencyKey: 'bad-event-key',
      snapshot: {
        ...sampleCard.snapshot,
        events: [{ ...sampleCard.snapshot.events[0], velocity: 5.5 }],
      },
    },
  });
  assert.equal(badEventRes.statusCode, 400);

  await app.close();
});
