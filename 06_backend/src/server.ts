import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { z } from 'zod';
import { ArchiveDatabase } from './db.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.resolve(__dirname, '..', 'data', 'holobeat-archive.sqlite');

const MintedCardSchema = z
  .object({
    id: z.string().min(1).max(128),
    serialNumber: z.number().int().min(0),
    code: z.string().min(1).max(32),
    idempotencyKey: z.string().min(1).max(256),
    title: z.string().min(1).max(64),
    rarity: z.enum(['SSR', 'UR', 'LTD']),
    foil: z.enum(['prism', 'gold', 'cyber', 'chrome', 'spark']),
    artId: z.string().min(1).max(64),
    sourceType: z.enum(['beat', 'pinball']),
    isDemo: z.boolean().optional(),
    parentCardId: z.string().optional(),
    parentCode: z.string().optional(),
    parentTitle: z.string().optional(),
    lineageDepth: z.number().int().min(0).default(0),
    createdAt: z.number().int().positive(),
  })
  .passthrough();

const CreateShareSchema = z.object({
  cardId: z.string().min(1).max(128),
});

export async function buildApp(options?: { dbPath?: string; publicBaseUrl?: string }) {
  const db = new ArchiveDatabase(options?.dbPath ?? DEFAULT_DB_PATH);
  const publicBase = options?.publicBaseUrl ?? 'http://127.0.0.1:3789';

  const app = Fastify({ logger: false });
  await app.register(cors, {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ],
    methods: ['GET', 'POST', 'DELETE'],
  });

  app.addHook('onClose', async () => {
    db.close();
  });

  app.get('/api/health', async () => ({
    ok: true,
    service: 'holobeat-archive-backend',
    version: '2.0.0',
    cardsCount: db.countCards(),
  }));

  app.get('/api/cards', async () => ({
    cards: db.listCards(),
  }));

  app.post('/api/cards', async (req, reply) => {
    const parsed = MintedCardSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid minted card payload', details: parsed.error.issues });
    }
    const result = db.upsertCardIdempotent(parsed.data);
    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.delete('/api/cards/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = db.deleteCard(id);
    if (!deleted) return reply.code(404).send({ error: 'Card not found' });
    return { ok: true, id };
  });

  app.get('/api/lineage/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const card = db.getCardById(id);
    if (!card) return reply.code(404).send({ error: 'Card not found' });
    return {
      card,
      ...db.getLineage(id),
    };
  });

  app.post('/api/shares', async (req, reply) => {
    const parsed = CreateShareSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid share payload' });
    }
    const token = randomBytes(12).toString('base64url');
    const created = db.createShareLink(token, parsed.data.cardId);
    if (!created) {
      return reply.code(404).send({ error: 'Card not found in archive' });
    }
    return reply.code(201).send({
      token: created.token,
      shareUrl: `${publicBase}/api/shares/${created.token}`,
      createdAt: created.createdAt,
    });
  });

  app.get('/api/shares/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const found = db.getSharedCard(token);
    if (!found) return reply.code(404).send({ error: 'Share link expired or revoked' });
    return found;
  });

  app.delete('/api/shares/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const ok = db.revokeShareLink(token);
    if (!ok) return reply.code(404).send({ error: 'Share token not found' });
    return { ok: true, revoked: true };
  });

  return app;
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const port = Number(process.env.PORT ?? 3789);
  const host = process.env.HOST ?? '127.0.0.1';
  const app = await buildApp({ publicBaseUrl: `http://${host}:${port}` });
  await app.listen({ port, host });
  console.log(`HoloBeat Archive Backend listening on http://${host}:${port}`);
}
