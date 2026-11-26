import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createSchemas } from '../../shared/card-schema.mjs';
import { prepareDefaultDirectory } from './archiveDirectory.ts';
import { ArchiveDatabase, ArchiveError } from './db.ts';

const DEFAULT_DB_PATH = fileURLToPath(new URL('../data/holobeat-archive.sqlite', import.meta.url));
const { MintedCardSchema } = createSchemas(z);
const CreateShareSchema = z.object({
  cardId: z.string().min(1).max(128),
  expiresAt: z.number().int().positive().safe().optional().nullable(),
}).strict();
const origins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForScript(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

const FOIL_ZH: Record<string, string> = {
  prism: '霓虹棱镜',
  gold: '流金烫印',
  cyber: '赛博镭射',
  chrome: '液态铬银',
  spark: '星屑细闪',
};

const SCALE_ZH: Record<string, string> = {
  PENTA_C: 'C 五声音阶',
  MINOR_C: 'C 自然小调',
  DORIAN_C: 'C 多利亚调式',
};

function renderRevokedHtmlPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>链接已失效 · HOLOBEAT 声卡造物局</title>
  <style>
    body { margin:0; font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif; background:#F7F3E9; color:#1A1A1F; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .box { max-width:440px; width:100%; background:#FFFDF8; border:3px solid #1A1A1F; border-radius:20px; box-shadow:6px 6px 0 #1A1A1F; padding:28px; text-align:center; }
    .badge { display:inline-block; background:#FF5C2B; color:#FFFDF8; font-weight:900; font-size:12px; padding:4px 12px; border-radius:999px; border:2px solid #1A1A1F; margin-bottom:14px; }
    h1 { margin:0 0 10px; font-size:22px; font-weight:900; }
    p { margin:0; font-size:14px; color:#646474; line-height:1.6; font-weight:600; }
  </style>
</head>
<body>
  <main class="box">
    <span class="badge">只读分享已撤销或不存在</span>
    <h1>这张声卡展页已失效</h1>
    <p>创作者可能已撤回该分享令牌，或此本地归档实例中尚未同步该藏品。请向创作者获取最新链接或直接导入 <code>.holobeat.json</code> 工程文件。</p>
  </main>
</body>
</html>`;
}

function renderShareShowcaseHtml(card: Record<string, unknown>, sharedAt: number): string {
  const title = escapeHtml(String(card.title ?? '未命名声卡'));
  const code = escapeHtml(String(card.code ?? '#MY-00'));
  const rarity = escapeHtml(String(card.rarity ?? 'SSR'));
  const foilKey = String(card.foil ?? 'prism');
  const foilLabel = escapeHtml(FOIL_ZH[foilKey] ?? foilKey);
  const sourceLabel = card.sourceType === 'pinball' ? '弹珠录制' : '节拍编曲';
  const lineageDepth = Number(card.lineageDepth ?? 0);
  const parentCode = card.parentCode ? escapeHtml(String(card.parentCode)) : '';
  const lineageText = parentCode ? `${parentCode} → 第 ${lineageDepth} 代变奏` : '原创首发';

  const snap = (card.snapshot ?? null) as Record<string, unknown> | null;
  const bpm = Number(snap?.bpm ?? 116);
  const scaleKey = String(snap?.scale ?? 'PENTA_C');
  const scaleLabel = escapeHtml(SCALE_ZH[scaleKey] ?? scaleKey);
  const events = Array.isArray(snap?.events) ? snap.events : [];
  const durationSec = ((Number(snap?.durationMs ?? 4000)) / 1000).toFixed(1);
  const bars = Array.isArray(card.waveformBars) && card.waveformBars.length > 0
    ? (card.waveformBars as number[]).slice(0, 32)
    : Array.from({ length: 24 }, (_, i) => 0.25 + ((i * 37) % 65) / 100);

  const projectExport = {
    schema: 'holobeat.project.v3',
    exportedAt: Date.now(),
    kind: 'minted-card',
    card,
  };

  const barsHtml = bars
    .map((v) => {
      const h = Math.max(14, Math.min(100, Math.round(Number(v) * 100)));
      return `<span class="bar" style="height:${h}%"></span>`;
    })
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} (${code}) · HOLOBEAT 只读声卡展页</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif; background:#F7F3E9; color:#1A1A1F; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .shell { max-width:860px; width:100%; display:grid; grid-template-columns:minmax(270px,340px) 1fr; gap:24px; background:#FFFDF8; border:3px solid #1A1A1F; border-radius:24px; box-shadow:8px 8px 0 #1A1A1F; padding:24px; }
    @media (max-width: 720px) { .shell { grid-template-columns:1fr; } }
    .card-frame { background:#14151B; color:#FFFDF8; border:3px solid #1A1A1F; border-radius:20px; padding:18px; display:flex; flex-direction:column; justify-content:space-between; min-height:410px; box-shadow:5px 5px 0 #1A1A1F; position:relative; overflow:hidden; }
    .card-top { display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .rarity { background:#FFD60A; color:#1A1A1F; border:2px solid #1A1A1F; border-radius:8px; padding:3px 10px; font-weight:900; font-size:12px; }
    .code { font-family:ui-monospace,Consolas,monospace; font-weight:800; font-size:12px; color:#00D4AA; }
    .hero-emblem { margin:20px auto; width:168px; height:168px; border-radius:24px; background:radial-gradient(circle at 35% 30%, rgba(124,58,237,0.45), rgba(0,212,170,0.18) 55%, rgba(20,21,27,0.95)); border:2.5px solid rgba(255,214,10,0.75); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:12px; }
    .hero-emblem strong { font-size:20px; letter-spacing:0.06em; color:#FFD60A; }
    .hero-emblem span { font-size:11px; color:rgba(255,253,248,0.72); margin-top:6px; font-weight:700; }
    .wave { height:46px; display:flex; align-items:flex-end; gap:3px; padding:8px; background:rgba(255,255,255,0.06); border-radius:12px; border:1px solid rgba(255,255,255,0.12); }
    .bar { flex:1; background:linear-gradient(180deg,#00D4AA,#7C3AED); border-radius:4px; min-height:6px; }
    .nameplate { margin-top:12px; background:#FFFDF8; color:#1A1A1F; border:2px solid #1A1A1F; border-radius:12px; padding:10px 12px; text-align:center; font-weight:900; font-size:17px; }
    .meta { display:flex; flex-direction:column; justify-content:space-between; gap:16px; }
    .eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:11px; font-weight:900; color:#7C3AED; background:#EDE7D9; border:2px solid #1A1A1F; border-radius:999px; padding:4px 12px; width:fit-content; }
    h1 { margin:8px 0 4px; font-size:28px; font-weight:900; line-height:1.2; }
    .subtitle { margin:0; font-size:13px; color:#646474; font-weight:700; }
    .specs { background:#EDE7D9; border:2px solid #1A1A1F; border-radius:16px; padding:14px 16px; display:grid; grid-template-columns:1fr 1fr; gap:10px 14px; font-size:13px; }
    .spec-label { color:#646474; font-size:11px; font-weight:800; display:block; }
    .spec-val { font-weight:900; color:#1A1A1F; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; }
    button { cursor:pointer; font-family:inherit; font-weight:900; font-size:13px; padding:11px 16px; border-radius:14px; border:2.5px solid #1A1A1F; box-shadow:3px 3px 0 #1A1A1F; transition:transform 120ms ease; }
    button:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #1A1A1F; }
    .btn-play { background:#00D4AA; color:#1A1A1F; }
    .btn-dl { background:#FFD60A; color:#1A1A1F; }
    .foot { font-size:11.5px; color:#646474; font-weight:700; line-height:1.5; border-top:1.5px dashed rgba(26,26,31,0.18); padding-top:10px; }
  </style>
</head>
<body>
  <main class="shell">
    <section class="card-frame" aria-label="声卡预览">
      <div class="card-top">
        <span class="rarity">${rarity} · ${foilLabel}</span>
        <span class="code">${code}</span>
      </div>
      <div class="hero-emblem">
        <strong>HOLOBEAT</strong>
        <span>${sourceLabel} · ${bpm} BPM</span>
        <span>${events.length} 音符 · ${durationSec}s</span>
      </div>
      <div>
        <div class="wave" aria-label="作品声纹">${barsHtml}</div>
        <div class="nameplate">${title}</div>
      </div>
    </section>

    <section class="meta">
      <div>
        <span class="eyebrow">HOLOBEAT · 声卡造物局 · 只读作品展页</span>
        <h1>${title}</h1>
        <p class="subtitle">把一条街，做成一张有声音的闪卡（程序化市井声景转译作品）</p>
      </div>

      <div class="specs">
        <div><span class="spec-label">藏品编号</span><span class="spec-val">${code}</span></div>
        <div><span class="spec-label">创作来源</span><span class="spec-val">${sourceLabel}</span></div>
        <div><span class="spec-label">调式与速度</span><span class="spec-val">${scaleLabel} · ${bpm} BPM</span></div>
        <div><span class="spec-label">创作谱系</span><span class="spec-val">${lineageText}</span></div>
        <div><span class="spec-label">全息箔面</span><span class="spec-val">${foilLabel} (${rarity})</span></div>
        <div><span class="spec-label">分享生成时间</span><span class="spec-val">${new Date(sharedAt).toLocaleString('zh-CN')}</span></div>
      </div>

      <div class="actions">
        <button id="playBtn" class="btn-play" type="button">▶ 试听音符轮廓</button>
        <button id="dlBtn" class="btn-dl" type="button">⬇ 下载可重混工程 (.holobeat.json)</button>
      </div>

      <p class="foot">
        此页面为只读展陈视图，不包含编辑与删除权限。下载工程文件后，可在任意本地 HOLOBEAT 工作台「04 闪卡工坊 → 导入工程」中完整还原并拆封重混。
      </p>
    </section>
  </main>

  <script>
    const PROJECT_DATA = ${safeJsonForScript(projectExport)};
    const NOTE_MIDI = { C:0, D:2, Eb:3, E:4, F:5, G:7, Ab:8, A:9, Bb:10, B:11 };
    function noteToHz(note) {
      const m = /^([A-G][b#]?)(\\d)$/.exec(String(note || 'C5'));
      if (!m) return 523.25;
      const semi = NOTE_MIDI[m[1]] ?? 0;
      const midi = Number(m[2]) * 12 + semi;
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    document.getElementById('dlBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(PROJECT_DATA, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (PROJECT_DATA.card.title || 'holobeat-card') + '.holobeat.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    document.getElementById('playBtn').addEventListener('click', async () => {
      const evs = (PROJECT_DATA.card.snapshot && PROJECT_DATA.card.snapshot.events) || [];
      if (!evs.length) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') await ctx.resume();
      const base = ctx.currentTime + 0.05;
      evs.forEach((ev) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = ev.trackCategory === 'BEAT' ? 'triangle' : ev.trackCategory === 'MELODY' ? 'square' : 'sine';
        const freq = ev.trackCategory === 'BEAT' ? 88 : noteToHz(ev.pitch);
        const start = base + (ev.timeOffsetMs || 0) / 1000;
        const dur = Math.min(0.45, Math.max(0.06, (ev.durationMs || 150) / 1000));
        osc.frequency.setValueAtTime(freq, start);
        if (ev.trackCategory === 'BEAT') osc.frequency.exponentialRampToValueAtTime(42, start + 0.12);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(Math.min(0.25, (ev.velocity || 0.7) * 0.22), start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    });
  </script>
</body>
</html>`;
}

export function listenOptions(env: NodeJS.ProcessEnv) {
  const host = env.HOST ?? '127.0.0.1';
  const port = Number(env.PORT ?? 3789);
  if (host !== '127.0.0.1') throw Error('The archive supports loopback access only');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid archive port');
  return { port, host };
}

export async function buildApp(options?: {
  dbPath?: string; publicBaseUrl?: string;
  writeToken?: string;
  authorizeWrite?: (request: FastifyRequest, resourceId?: string) => boolean | Promise<boolean>;
}) {
  const publicBase = options?.publicBaseUrl ?? 'http://127.0.0.1:3789';
  if (!options?.dbPath) prepareDefaultDirectory(path.dirname(DEFAULT_DB_PATH));
  const db = new ArchiveDatabase(options?.dbPath ?? DEFAULT_DB_PATH);
  const configuredToken = options?.writeToken ?? process.env.HOLOBEAT_WRITE_TOKEN;
  const writeHits: number[] = []; // Only the trusted loopback principal can write.
  const matches = (provided: unknown, expected: string) =>
    typeof provided === 'string' && Buffer.byteLength(provided) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  const token = randomBytes(32).toString('base64url');
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024, trustProxy: false });
  app.addHook('onClose', async () => db.close());
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (!loopback.has(req.ip) || !/^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(req.headers.host ?? '') ||
      (origin !== undefined && !origins.includes(origin) && origin !== publicBase)) {
      return reply.code(403).send({ code: 'LOCAL_ONLY', error: 'Untrusted local request' });
    }
    reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff');
  });
  await app.register(cors, { origin: [...origins, publicBase], methods: ['GET','POST','DELETE'],
    allowedHeaders: ['Content-Type','X-HoloBeat-Write-Token','X-HoloBeat-Token'] });
  app.addHook('preHandler', async (req, reply) => {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return;
    const configuredAccess = configuredToken && matches(req.headers['x-holobeat-token'], configuredToken);
    if (!configuredAccess && !matches(req.headers['x-holobeat-write-token'], token)) {
      return reply.code(configuredToken ? 401 : 403).send({ code: 'WRITE_DENIED', error: 'Local write session required' });
    }
    const now = Date.now();
    while (writeHits.length && writeHits[0] <= now - 60000) writeHits.shift();
    if (writeHits.length >= 60) return reply.code(429).send({ code:'RATE_LIMIT',error:'Too many writes' });
    writeHits.push(now);
    if (options?.authorizeWrite) {
      const params = req.params as { id?: string; token?: string };
      const body = req.body as { cardId?: string; id?: string } | undefined;
      if (!await options.authorizeWrite(req, params.id ?? params.token ?? body?.cardId ?? body?.id))
        return reply.code(403).send({ code: 'WRITE_DENIED', error: 'Resource access denied' });
    }
  });
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ArchiveError) return reply.code(err.status).send({ code: err.code, error: err.message });
    const e = err as Error & { errcode?: number; statusCode?: number; code?: string };
    const sqliteResult = (e.errcode ?? 0) & 255;
    if (sqliteResult === 19) return reply.code(409).send({ code: 'ARCHIVE_CONSTRAINT', error: 'Duplicate serial/code or incompatible archive parent' });
    if (sqliteResult === 5 || sqliteResult === 6) return reply.code(503).send({ code: 'ARCHIVE_BUSY', error: 'Archive is busy' });
    const status = e.statusCode ?? 500;
    return reply.code(status).send({ code: status === 500 ? 'ARCHIVE_ERROR' : e.code, error: status === 500 ? 'Archive operation failed' : e.message });
  });
  const health = async () => ({ ok:true, service:'holobeat-archive-backend', version:'3.0.0', cardsCount:db.countCards() });
  app.get('/health', health);
  app.get('/api/health', health);
  app.get('/api/session', async (req, reply) => {
    if (configuredToken && !matches(req.headers['x-holobeat-token'], configuredToken))
      return reply.code(401).send({ code:'WRITE_DENIED',error:'Configured archive credential required' });
    return { writeToken:token };
  });
  app.get('/api/cards', async () => ({ cards:db.listCards() }));
  app.post('/api/cards', async (req, reply) => {
    const parsed = MintedCardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_CARD', error:'Invalid minted card', details:parsed.error.issues.slice(0,8) });
    const result = await db.upsertCardIdempotent(parsed.data);
    return reply.code(result.created ? 201 : 200).send(result);
  });
  app.delete('/api/cards/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!db.deleteCard(id)) return reply.code(404).send({ error:'Card not found' });
    return { ok:true,id };
  });
  app.get('/api/lineage/:id', async (req, reply) => {
    const { id } = req.params as { id:string };
    const card = db.getCardById(id);
    if (!card) return reply.code(404).send({ error:'Card not found' });
    return { card,...db.getLineage(id) };
  });
  app.post('/api/shares', async (req, reply) => {
    const parsed = CreateShareSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ code:'INVALID_SHARE',error:'Invalid share payload' });
    const link = db.createShareLink(randomBytes(24).toString('base64url'),parsed.data.cardId,parsed.data.expiresAt ?? null);
    if (!link) return reply.code(404).send({ error:'Card not found' });
    return reply.code(link.created ? 201 : 200).send({ token:link.token,createdAt:link.createdAt,expiresAt:link.expiresAt,
      shareUrl:publicBase + '/share/' + link.token, apiUrl:publicBase + '/api/shares/' + link.token });
  });
  app.get('/share/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const found = db.getSharedCard(token);
    if (!found) {
      return reply
        .code(404)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(renderRevokedHtmlPage());
    }
    return reply
      .code(200)
      .header('Content-Type', 'text/html; charset=utf-8')
      .send(renderShareShowcaseHtml({...found.card}, found.createdAt));
  });

  app.get('/api/shares/:token', async (req, reply) => {
    const { token } = req.params as { token:string };
    return db.getSharedCard(token) ?? reply.code(404).send({ error:'Share expired or revoked' });
  });
  app.delete('/api/shares/:token', async (req, reply) => {
    const { token } = req.params as { token:string };
    if (!db.revokeShareLink(token)) return reply.code(404).send({ error:'Share token not found' });
    return { ok:true,revoked:true };
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { port, host } = listenOptions(process.env);
  const app = await buildApp({ dbPath:process.env.HOLOBEAT_DB_PATH,publicBaseUrl:`http://${host}:${port}` });
  try { await app.listen({ port,host }); }
  catch (err) { await app.close(); throw err; }
  process.once('SIGINT', () => void app.close());
  process.once('SIGTERM', () => void app.close());
  console.log(`HoloBeat Archive Backend listening on http://${host}:${port}`);
}
