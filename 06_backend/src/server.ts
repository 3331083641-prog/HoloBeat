import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { z } from 'zod';
import { ArchiveDatabase } from './db.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.resolve(__dirname, '..', 'data', 'holobeat-archive.sqlite');

const StickerSchema = z.object({
  uid: z.string().min(1).max(128),
  stickerId: z.string().min(1).max(64),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  scale: z.number().min(0.2).max(4),
  rotation: z.number().min(-360).max(360),
  zIndex: z.number().int().min(0).max(1000).optional(),
});

const MusicalEventSchema = z.object({
  id: z.string().min(1).max(128),
  timeOffsetMs: z.number().min(0).max(120_000),
  durationMs: z.number().positive().max(30_000),
  trackIndex: z.number().int().min(0).max(3),
  trackCategory: z.enum(['BEAT', 'PERC', 'MELODY', 'VIBE']),
  cardId: z.string().min(1).max(64),
  pitch: z.string().min(1).max(16),
  velocity: z.number().min(0).max(1),
  stepIndex: z.number().int().min(0).max(31).optional(),
  tone: z.number().min(0).max(1).optional(),
});

const SnapshotSchema = z.object({
  id: z.string().min(1).max(128),
  schemaVersion: z.number().int().min(1).max(10).optional(),
  contentSignature: z.string().max(256).optional(),
  sourceType: z.enum(['beat', 'pinball']),
  title: z.string().min(1).max(64),
  bpm: z.number().min(40).max(240),
  swing: z.number().min(0).max(0.8),
  scale: z.enum(['PENTA_C', 'MINOR_C', 'DORIAN_C']),
  bars: z.union([z.literal(1), z.literal(2)]),
  durationMs: z.number().min(100).max(120_000),
  tailMs: z.number().min(0).max(15_000).optional(),
  events: z.array(MusicalEventSchema).max(256),
  beatSnapshot: z.unknown().optional(),
  pinballSnapshot: z.unknown().optional(),
  isDemo: z.boolean().optional(),
  frozenAt: z.number().int().positive().optional(),
  createdAt: z.number().int().positive().optional(),
});

const MintedCardSchema = z.object({
  id: z.string().min(1).max(128),
  schemaVersion: z.number().int().min(1).max(10).optional(),
  assetVersion: z.string().max(32).optional(),
  rendererVersion: z.string().max(32).optional(),
  serialNumber: z.number().int().min(0),
  code: z.string().min(1).max(32),
  idempotencyKey: z.string().min(1).max(512),
  title: z.string().min(1).max(64),
  rarity: z.enum(['SSR', 'UR', 'LTD']),
  foil: z.enum(['prism', 'gold', 'cyber', 'chrome', 'spark']),
  artId: z.string().min(1).max(64),
  sourceType: z.enum(['beat', 'pinball']),
  isDemo: z.boolean().optional(),
  stickers: z.array(StickerSchema).max(32).default([]),
  waveformBars: z.array(z.number().min(0).max(1.5)).max(128).default([]),
  waveformIsRealPcm: z.boolean().optional(),
  audioCacheKey: z.string().max(256).optional(),
  audioFingerprintSeed: z.number().optional(),
  snapshot: SnapshotSchema.optional(),
  parentCardId: z.string().max(128).optional(),
  parentCode: z.string().max(32).optional(),
  parentTitle: z.string().max(64).optional(),
  lineageDepth: z.number().int().min(0).max(99).default(0),
  storageStatus: z.enum(['primary', 'fallback']).optional(),
  createdAt: z.number().int().positive(),
});

const CreateShareSchema = z.object({
  cardId: z.string().min(1).max(128),
});

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

export async function buildApp(options?: {
  dbPath?: string;
  publicBaseUrl?: string;
  writeToken?: string;
}) {
  const db = new ArchiveDatabase(options?.dbPath ?? DEFAULT_DB_PATH);
  const publicBase = options?.publicBaseUrl ?? 'http://127.0.0.1:3789';
  const writeToken = options?.writeToken ?? process.env.HOLOBEAT_WRITE_TOKEN;

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

  // Simple in-memory sliding-window rate limiter for write routes
  const writeHits = new Map<string, number[]>();
  const checkWriteGuard = (req: { ip?: string; headers: Record<string, unknown> }) => {
    if (writeToken) {
      const provided = String(req.headers['x-holobeat-token'] ?? '');
      if (provided !== writeToken) {
        return { ok: false, code: 401, error: 'Missing or invalid write token' };
      }
    }
    const ip = req.ip ?? 'local';
    const now = Date.now();
    const recent = (writeHits.get(ip) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= 60) {
      return { ok: false, code: 429, error: 'Too many write requests; please slow down' };
    }
    recent.push(now);
    writeHits.set(ip, recent);
    return { ok: true as const };
  };

  app.addHook('onClose', async () => {
    db.close();
  });

  app.get('/api/health', async () => ({
    ok: true,
    service: 'holobeat-archive-backend',
    version: '3.0.0',
    cardsCount: db.countCards(),
  }));

  app.get('/api/cards', async () => ({
    cards: db.listCards(),
  }));

  app.post('/api/cards', async (req, reply) => {
    const guard = checkWriteGuard(req);
    if (!guard.ok) return reply.code(guard.code!).send({ error: guard.error });

    const parsed = MintedCardSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid minted card payload',
        details: parsed.error.issues,
      });
    }
    const result = db.upsertCardIdempotent(parsed.data);
    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.delete('/api/cards/:id', async (req, reply) => {
    const guard = checkWriteGuard(req);
    if (!guard.ok) return reply.code(guard.code!).send({ error: guard.error });

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
    const guard = checkWriteGuard(req);
    if (!guard.ok) return reply.code(guard.code!).send({ error: guard.error });

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
      shareUrl: `${publicBase}/share/${created.token}`,
      apiUrl: `${publicBase}/api/shares/${created.token}`,
      createdAt: created.createdAt,
    });
  });

  // Read-only HTML artwork showcase page (Fix #10!)
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
      .send(renderShareShowcaseHtml(found.card as Record<string, unknown>, found.createdAt));
  });

  app.get('/api/shares/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const found = db.getSharedCard(token);
    if (!found) return reply.code(404).send({ error: 'Share link expired or revoked' });
    return found;
  });

  app.delete('/api/shares/:token', async (req, reply) => {
    const guard = checkWriteGuard(req);
    if (!guard.ok) return reply.code(guard.code!).send({ error: guard.error });

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
