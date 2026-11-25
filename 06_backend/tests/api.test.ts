import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/server.ts';

const sampleCard = {
  id: 'minted-test-001',
  serialNumber: 1,
  code: '#MY-01',
  idempotencyKey: 'snap-1::TEST::UR::prism::neon-dj::0',
  title: 'HUTONG TEST',
  rarity: 'UR' as const,
  foil: 'prism' as const,
  artId: 'neon-dj',
  sourceType: 'beat' as const,
  isDemo: false,
  lineageDepth: 0,
  createdAt: Date.now(),
};

test('HoloBeat Archive Backend: health, idempotent save, lineage & share lifecycle', async () => {
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
    idempotencyKey: 'snap-2::REMIX::UR::gold::neon-dj::0',
    title: 'HUTONG REMIX',
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

  // Share token creation, read-only fetch & revocation
  const shareRes = await app.inject({
    method: 'POST',
    url: '/api/shares',
    payload: { cardId: sampleCard.id },
  });
  assert.equal(shareRes.statusCode, 201);
  const { token } = shareRes.json();

  const fetchShared = await app.inject({ method: 'GET', url: `/api/shares/${token}` });
  assert.equal(fetchShared.statusCode, 200);
  assert.equal(fetchShared.json().card.code, '#MY-01');

  const revokeRes = await app.inject({ method: 'DELETE', url: `/api/shares/${token}` });
  assert.equal(revokeRes.statusCode, 200);

  const fetchRevoked = await app.inject({ method: 'GET', url: `/api/shares/${token}` });
  assert.equal(fetchRevoked.statusCode, 404);

  await app.close();
});
