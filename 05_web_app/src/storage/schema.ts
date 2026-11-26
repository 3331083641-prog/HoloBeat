import { z } from 'zod';
import { createSchemas } from '../../../shared/card-schema.mjs';
const { ProjectSchema, ForgeDraftSchema } = createSchemas(z);
import {
  ASSET_VERSION,
  RENDERER_VERSION,
  SCHEMA_VERSION,
  buildAudioCacheKey,
  buildMintIdempotencyKey,
  compileBeatToEvents,
  computeCompositionContentSignature,
  computeEventWaveformBars,
  computeSoundSigilSeed,
  normalizeTrackState,
} from '../audio/compositionEngine.ts';
import { SOUND_CARDS } from '../data/soundCards.ts';
import { STICKER_PACK } from '../data/stickers.ts';
import type {
  BeatSnapshot,
  CompositionSnapshot,
  ForgeDraft,
  ForgeRarity,
  HoloBeatProjectFile,
  HoloFoilType,
  MigrationReport,
  MintedCard,
  PlacedSticker,
  ScaleId,
  TrackCategory,
} from '../types/holo';

const VALID_RARITIES = new Set<ForgeRarity>(['SSR', 'UR', 'LTD']);
const VALID_FOILS = new Set<HoloFoilType>(['prism', 'spark', 'cyber', 'chrome', 'gold']);
const VALID_SCALES = new Set<ScaleId>(['PENTA_C', 'MINOR_C', 'DORIAN_C']);
const VALID_CATEGORIES = new Set<TrackCategory>(['BEAT', 'PERC', 'MELODY', 'VIBE']);
const VALID_CARD_IDS = new Set<string>(SOUND_CARDS.map((c) => c.id));
const VALID_STICKER_IDS = new Set<string>(STICKER_PACK.map((s) => s.id));

export interface ProjectValidationResult {
  ok: boolean;
  error?: string;
  warnings: string[];
  project?: HoloBeatProjectFile;
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function sanitizeStickers(raw: unknown, warnings: string[]): PlacedSticker[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > 48) return null;
  const out: PlacedSticker[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') return null;
    if (typeof item.uid !== 'string' || typeof item.stickerId !== 'string') return null;
    if (!isFiniteNum(item.x) || !isFiniteNum(item.y)) return null;
    if (!VALID_STICKER_IDS.has(item.stickerId)) {
      warnings.push(`未知贴纸资源「${item.stickerId}」，已自动回退默认贴纸`);
    }
    out.push({
      uid: item.uid.slice(0, 64),
      stickerId: VALID_STICKER_IDS.has(item.stickerId) ? item.stickerId : STICKER_PACK[0].id,
      x: Math.min(100, Math.max(0, item.x)),
      y: Math.min(100, Math.max(0, item.y)),
      scale: isFiniteNum(item.scale) ? Math.min(2.2, Math.max(0.4, item.scale)) : 1,
      rotation: isFiniteNum(item.rotation) ? item.rotation : 0,
      zIndex: isFiniteNum(item.zIndex) ? Math.round(item.zIndex) : i + 1,
    });
  }
  return out;
}

function validateAndMigrateSnapshot(
  raw: unknown,
  warnings: string[]
): CompositionSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== 'string' || s.id.length === 0 || s.id.length > 128) return null;
  if (s.sourceType !== 'beat' && s.sourceType !== 'pinball') return null;
  if (!isFiniteNum(s.bpm) || s.bpm < 40 || s.bpm > 240) return null;
  if (!isFiniteNum(s.durationMs) || s.durationMs < 200 || s.durationMs > 120_000) return null;
  if (!VALID_SCALES.has(s.scale as ScaleId)) return null;
  if (!Array.isArray(s.events) || s.events.length > 2000) return null;

  let beatSnapshot: BeatSnapshot | undefined;
  if (s.sourceType === 'beat' && s.beatSnapshot && typeof s.beatSnapshot === 'object') {
    const bs = s.beatSnapshot as Record<string, unknown>;
    if (!Array.isArray(bs.tracks) || bs.tracks.length !== 4) return null;
    const bars: 1 | 2 = bs.bars === 1 ? 1 : 2;
    const tracks = [];
    for (let i = 0; i < 4; i++) {
      const t = bs.tracks[i] as Record<string, unknown>;
      if (!t || typeof t !== 'object') return null;
      if (!VALID_CATEGORIES.has(t.category as TrackCategory)) return null;
      if (typeof t.cardId !== 'string') return null;
      if (!Array.isArray(t.steps) || t.steps.length === 0 || t.steps.length > 32) return null;
      let cardId = t.cardId;
      if (!VALID_CARD_IDS.has(cardId)) {
        warnings.push(`工程引用了未收录的声卡「${cardId}」，已回退默认音色`);
        cardId = SOUND_CARDS[i * 4]?.id ?? 'card-01';
      }
      tracks.push(
        normalizeTrackState(
          {
            category: t.category as TrackCategory,
            cardId,
            steps: t.steps.map(Boolean),
            accents: Array.isArray(t.accents) ? t.accents.map(Boolean) : undefined,
            stepCells: Array.isArray(t.stepCells) ? t.stepCells : undefined,
            volume: isFiniteNum(t.volume) ? t.volume : 0.8,
            tone: isFiniteNum(t.tone) ? t.tone : 0.5,
            mute: Boolean(t.mute),
            solo: Boolean(t.solo),
          },
          bars
        )
      );
    }

    const rawFx = (bs.liveFx ?? {}) as Record<string, unknown>;
    beatSnapshot = {
      bpm: Math.min(180, Math.max(60, Math.round(isFiniteNum(bs.bpm) ? bs.bpm : (s.bpm as number)))),
      swing: isFiniteNum(bs.swing) ? Math.min(0.6, Math.max(0, bs.swing)) : 0,
      scale: VALID_SCALES.has(bs.scale as ScaleId) ? (bs.scale as ScaleId) : (s.scale as ScaleId),
      bars,
      activePhraseLoop:
        bs.activePhraseLoop === 'A' || bs.activePhraseLoop === 'B' || bs.activePhraseLoop === 'AB'
          ? bs.activePhraseLoop
          : bars === 1
            ? 'A'
            : 'AB',
      liveFx: {
        bitcrush: Boolean(rawFx.bitcrush),
        echo: Boolean(rawFx.echo),
        stutter: Boolean(rawFx.stutter),
      },
      tracks,
    };
  }

  // Validate individual events
  const events = [];
  for (let i = 0; i < s.events.length; i++) {
    const ev = s.events[i] as Record<string, unknown>;
    if (!ev || typeof ev !== 'object') return null;
    if (!isFiniteNum(ev.timeOffsetMs) || ev.timeOffsetMs < 0 || ev.timeOffsetMs > 120_000) return null;
    if (typeof ev.cardId !== 'string' || typeof ev.pitch !== 'string') return null;
    events.push({
      id: typeof ev.id === 'string' ? ev.id : `ev-mig-${i}`,
      timeOffsetMs: Math.round(ev.timeOffsetMs),
      durationMs: isFiniteNum(ev.durationMs) ? Math.max(40, Math.min(10_000, ev.durationMs)) : 240,
      pitch: ev.pitch.slice(0, 8),
      velocity: isFiniteNum(ev.velocity) ? Math.min(1, Math.max(0.15, ev.velocity)) : 0.8,
      cardId: VALID_CARD_IDS.has(ev.cardId) ? ev.cardId : 'card-01',
      trackCategory: VALID_CATEGORIES.has(ev.trackCategory as TrackCategory)
        ? (ev.trackCategory as TrackCategory)
        : 'MELODY',
      trackIndex: isFiniteNum(ev.trackIndex) ? Math.min(3, Math.max(0, Math.round(ev.trackIndex))) : 0,
      stepIndex: isFiniteNum(ev.stepIndex) ? Math.min(31, Math.max(0, Math.round(ev.stepIndex))) : undefined,
      tone: isFiniteNum(ev.tone) ? Math.min(1, Math.max(0, ev.tone)) : 0.5,
      sourceX: isFiniteNum(ev.sourceX) ? ev.sourceX : undefined,
      sourceY: isFiniteNum(ev.sourceY) ? ev.sourceY : undefined,
      color: typeof ev.color === 'string' ? ev.color : '#00D4AA',
    });
  }

  // For migrated beat snapshots, recompile if legacy 16-step had 2 bars to ensure 32-step consistency
  const finalEvents =
    beatSnapshot && Number(s.schemaVersion ?? 2) < SCHEMA_VERSION
      ? compileBeatToEvents(beatSnapshot)
      : events;

  const migrated: CompositionSnapshot = {
    id: s.id,
    schemaVersion: SCHEMA_VERSION,
    rendererVersion: typeof s.rendererVersion === 'string' ? s.rendererVersion : RENDERER_VERSION,
    assetVersion: typeof s.assetVersion === 'string' ? s.assetVersion : ASSET_VERSION,
    title: typeof s.title === 'string' ? s.title.slice(0, 32) : undefined,
    sourceType: s.sourceType,
    isDemo: Boolean(s.isDemo),
    capturedAt: isFiniteNum(s.capturedAt) ? s.capturedAt : Date.now(),
    durationMs: Math.round(s.durationMs),
    tailMs: isFiniteNum(s.tailMs) ? Math.round(s.tailMs) : beatSnapshot?.liveFx.echo ? 1450 : 880,
    bpm: Math.round(s.bpm),
    swing: isFiniteNum(s.swing) ? s.swing : beatSnapshot?.swing ?? 0,
    scale: s.scale as ScaleId,
    bars: beatSnapshot?.bars ?? (s.bars === 1 ? 1 : 2),
    beatSnapshot,
    pinballEvents: Array.isArray(s.pinballEvents) ? s.pinballEvents : undefined,
    pinballScene:
      s.pinballScene && typeof s.pinballScene === 'object'
        ? (s.pinballScene as CompositionSnapshot['pinballScene'])
        : undefined,
    events: finalEvents,
  };

  migrated.contentSignature = computeCompositionContentSignature(migrated);
  return migrated;
}

export function migrateMintedCard(raw: unknown, warnings: string[] = []): MintedCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== 'string' || typeof c.title !== 'string') return null;
  if (!VALID_RARITIES.has(c.rarity as ForgeRarity)) return null;
  if (!VALID_FOILS.has(c.foil as HoloFoilType)) return null;
  if (c.sourceType !== 'beat' && c.sourceType !== 'pinball') return null;

  const snapshot = validateAndMigrateSnapshot(c.snapshot, warnings);
  if (!snapshot) return null;

  const stickers = sanitizeStickers(c.stickers ?? [], warnings);
  if (!stickers) return null;

  const serialNumber = isFiniteNum(c.serialNumber) ? Math.max(0, Math.round(c.serialNumber)) : 0;
  const title = c.title.trim().slice(0, 24) || '胡同放克';
  const artId = typeof c.artId === 'string' && c.artId.length > 0 ? c.artId : 'neon-dj';
  const waveformBars =
    Array.isArray(c.waveformBars) && c.waveformBars.length > 0 && c.waveformBars.every(isFiniteNum)
      ? (c.waveformBars as number[]).slice(0, 64)
      : computeEventWaveformBars(snapshot.events, snapshot.durationMs);

  const idempotencyKey = buildMintIdempotencyKey({
    snapshotId: snapshot.id,
    contentSignature: snapshot.contentSignature,
    title,
    rarity: c.rarity as ForgeRarity,
    foil: c.foil as HoloFoilType,
    artId,
    assetVersion: ASSET_VERSION,
    stickers,
  });

  return {
    id: c.id,
    schemaVersion: SCHEMA_VERSION,
    assetVersion: typeof c.assetVersion === 'string' ? c.assetVersion : ASSET_VERSION,
    rendererVersion: typeof c.rendererVersion === 'string' ? c.rendererVersion : RENDERER_VERSION,
    serialNumber,
    code:
      typeof c.code === 'string' && c.code.length > 0
        ? c.code
        : c.isDemo
          ? '#示例-01'
          : `#MY-${String(serialNumber).padStart(2, '0')}`,
    idempotencyKey,
    title,
    rarity: c.rarity as ForgeRarity,
    foil: c.foil as HoloFoilType,
    artId,
    sourceType: c.sourceType,
    isDemo: Boolean(c.isDemo),
    stickers,
    waveformBars,
    waveformIsRealPcm: Boolean(c.waveformIsRealPcm),
    audioCacheKey: buildAudioCacheKey(snapshot),
    audioFingerprintSeed: isFiniteNum(c.audioFingerprintSeed)
      ? c.audioFingerprintSeed
      : computeSoundSigilSeed(snapshot),
    snapshot,
    parentCardId: typeof c.parentCardId === 'string' ? c.parentCardId : undefined,
    parentCode: typeof c.parentCode === 'string' ? c.parentCode : undefined,
    parentTitle: typeof c.parentTitle === 'string' ? c.parentTitle : undefined,
    lineageDepth: isFiniteNum(c.lineageDepth) ? Math.max(0, Math.round(c.lineageDepth)) : 0,
    storageStatus: c.storageStatus === 'fallback' ? 'fallback' : 'primary',
    createdAt: isFiniteNum(c.createdAt) ? c.createdAt : Date.now(),
  };
}

export function migrateForgeDraft(raw: unknown, warnings: string[] = []): ForgeDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.sourceType !== 'beat' && d.sourceType !== 'pinball') return null;
  const stickers = sanitizeStickers(d.stickers ?? [], warnings);
  if (!stickers) return null;
  const snapshot = d.snapshot != null ? validateAndMigrateSnapshot(d.snapshot, warnings) : null;
  if (d.snapshot != null && !snapshot) return null;
  const candidate = {
    snapshot,
    sourceType: d.sourceType,
    title: typeof d.title === 'string' ? d.title.slice(0, 18) : '胡同放克',
    rarity: VALID_RARITIES.has(d.rarity as ForgeRarity) ? (d.rarity as ForgeRarity) : 'UR',
    foil: VALID_FOILS.has(d.foil as HoloFoilType) ? (d.foil as HoloFoilType) : 'prism',
    artId: typeof d.artId === 'string' && d.artId.length > 0 ? d.artId : 'neon-dj',
    stickers,
    remixOrigin:
      d.remixOrigin && typeof d.remixOrigin === 'object'
        ? (d.remixOrigin as ForgeDraft['remixOrigin'])
        : null,
  };
  const parsed = ForgeDraftSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Full audited migration from legacy v1/v2 card arrays to v3, verifying card count,
 * monotonic serials, valid durations, and non-empty playable events.
 */
export function migrateMintedCardsCollection(
  rawCards: unknown[],
  backedUp = false
): { cards: MintedCard[]; report: MigrationReport } {
  const warnings: string[] = [];
  const cards: MintedCard[] = [];
  let minFromVersion = SCHEMA_VERSION;

  rawCards.forEach((raw, idx) => {
    const r = raw as Record<string, unknown>;
    const v = typeof r?.schemaVersion === 'number' ? r.schemaVersion : 2;
    if (v < minFromVersion) minFromVersion = v;
    const migrated = migrateMintedCard(raw, warnings);
    if (migrated) {
      cards.push(migrated);
    } else {
      warnings.push(`第 ${idx + 1} 张旧档案结构损坏，已安全跳过`);
    }
  });

  const maxSerial = cards.reduce((m, c) => Math.max(m, c.serialNumber), 0);
  const verifiedPlayable = cards.every(
    (c) => c.snapshot.durationMs > 0 && Array.isArray(c.snapshot.events)
  );

  return {
    cards,
    report: {
      migrated: minFromVersion < SCHEMA_VERSION,
      backedUp,
      fromVersion: minFromVersion,
      toVersion: SCHEMA_VERSION,
      cardCount: cards.length,
      maxSerial,
      verifiedPlayable,
      warnings,
    },
  };
}

/**
 * Strict validation for imported .holobeat.json files (v2 or v3).
 * Rejects malformed or corrupted files without overwriting any user work!
 */
function convertProjectFile(raw: unknown): ProjectValidationResult {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: '工程文件不是有效的 JSON 对象', warnings };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== 'holobeat.project.v2' && obj.schema !== 'holobeat.project.v3') {
    return { ok: false, error: '不支持的工程版本（仅支持 holobeat.project.v2 / v3）', warnings };
  }
  if (obj.kind !== 'minted-card' && obj.kind !== 'forge-draft') {
    return { ok: false, error: '工程类型无效（缺少 minted-card 或 forge-draft 标识）', warnings };
  }

  if (obj.kind === 'minted-card') {
    const card = migrateMintedCard(obj.card, warnings);
    if (!card) {
      return { ok: false, error: '工程文件中的藏品快照或音符数据校验失败', warnings };
    }
    return {
      ok: true,
      warnings,
      project: {
        schema: 'holobeat.project.v3',
        exportedAt: isFiniteNum(obj.exportedAt) ? obj.exportedAt : Date.now(),
        assetVersion: ASSET_VERSION,
        rendererVersion: RENDERER_VERSION,
        kind: 'minted-card',
        card,
      },
    };
  }

  const draft = migrateForgeDraft(obj.draft, warnings);
  if (!draft) {
    return { ok: false, error: '工程文件中的草稿结构校验失败', warnings };
  }
  return {
    ok: true,
    warnings,
    project: {
      schema: 'holobeat.project.v3',
      exportedAt: isFiniteNum(obj.exportedAt) ? obj.exportedAt : Date.now(),
      assetVersion: ASSET_VERSION,
      rendererVersion: RENDERER_VERSION,
      kind: 'forge-draft',
      draft,
    },
  };
}

// Every import, including converted legacy data, crosses the same current boundary.
export function validateProjectFile(raw: unknown): ProjectValidationResult {
  const converted = (raw as {schema?:string})?.schema === 'holobeat.project.v3'
    ? {ok:true,project:raw,warnings:[] as string[]} : convertProjectFile(raw);
  if (!converted.ok) return converted as ProjectValidationResult;
  const parsed = ProjectSchema.safeParse(converted.project);
  return parsed.success ? {ok:true,project:parsed.data,warnings:converted.warnings}
    : {ok:false,error:'工程快照、场景或来源数据校验失败',warnings:converted.warnings};
}
